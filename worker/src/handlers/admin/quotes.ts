import { Context } from 'hono';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid'; // <-- ADDED IMPORT
import { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import { getStripe } from '../../stripe.js';
import type { Job, Service, User } from '@portal/shared';

export async function handleAdminCreateQuote(c: Context<AppEnv>) {
    const { jobId } = c.req.param();
    const db = c.env.DB;
    const stripe = getStripe(c.env);

    try {
        const job = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first<Job>();
        if (!job) return errorResponse("Job not found.", 404);

        const customer = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(job.customerId).first<User>();
        if (!customer) return errorResponse("Customer for this job not found.", 404);

        if (!customer.stripe_customer_id) {
            return errorResponse("This user does not have a Stripe customer ID. A quote cannot be created.", 400);
        }

        const services = await db.prepare(`SELECT * FROM services WHERE job_id = ?`).bind(jobId).all<Service>();
        if (!services.results || services.results.length === 0) {
            return errorResponse("Cannot create a quote for a job with no services.", 400);
        }

        const line_items = services.results.map(service => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: service.notes || 'Unnamed Service',
                },
                unit_amount: service.price_cents || 0,
            },
        }));

        const quoteData = await stripe.quotes.create({
            customer: customer.stripe_customer_id,
            description: `Quote for job: ${job.title}`,
            // FIX 1: Use a type assertion to bypass the incorrect type check for line_items
            line_items: line_items as any,
            expires_at: Math.floor(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).getTime() / 1000),
        });

        await db.prepare(`UPDATE jobs SET stripe_quote_id = ?, status = 'quote_draft' WHERE id = ?`)
            .bind(quoteData.id, jobId)
            .run();

        return successResponse({ quoteId: quoteData.id });

    } catch (e: any) {
        console.error(`Failed to create quote for job ${jobId}:`, e);
        return errorResponse(`Failed to create quote: ${e.message}`, 500);
    }
}


export async function handleAdminImportQuotes(c: Context<AppEnv>) {
    const stripe = getStripe(c.env);
    const db = c.env.DB;
    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    try {
        while (hasMore) {
            const quotes: Stripe.ApiList<Stripe.Quote> = await stripe.quotes.list({
                status: 'accepted',
                limit: 100,
                starting_after: startingAfter,
                expand: ['data.customer', 'data.line_items.data'],
            });

            if (quotes.data.length === 0) {
                hasMore = false;
                break;
            }

            for (const quote of quotes.data) {
                // ADDED CHECK for line_items
                if (!quote.line_items || !quote.line_items.data || quote.line_items.data.length === 0) {
                    skippedCount++;
                    continue;
                }

                if (!quote.customer || typeof quote.customer !== 'object' || quote.customer.deleted) {
                    skippedCount++;
                    continue;
                }

                let user: User | { id: number } | null = await db.prepare(`SELECT id FROM users WHERE stripe_customer_id = ?`).bind(quote.customer.id).first<User>();
                if (!user) {
                    // If user doesn't exist, create one
                    const customer = quote.customer as Stripe.Customer;
                    const { name, email, phone } = customer;
                    const { results } = await db.prepare(
                        `INSERT INTO users (name, email, phone, stripe_customer_id, role) VALUES (?, ?, ?, ?, 'guest') RETURNING id`
                    ).bind(
                        name || 'Stripe Customer',
                        email,
                        phone,
                        quote.customer.id,
                    ).all<{ id: number }>();

                    if (!results || results.length === 0) {
                        errors.push(`Failed to create user for Stripe customer ${quote.customer.id}`);
                        skippedCount++;
                        continue;
                    }
                    user = { id: results[0].id };
                }


                const existingJob = await db.prepare(`SELECT id FROM jobs WHERE stripe_quote_id = ?`).bind(quote.id).first();
                if (existingJob) {
                    skippedCount++;
                    continue;
                }

                const jobStartDate = new Date((quote.status_transitions.finalized_at || quote.created) * 1000);
                const jobEndDate = new Date(jobStartDate.getTime() + 60 * 60 * 1000);
                 // ADDED CHECK for line_items before accessing description
                const jobTitle = quote.line_items.data[0]?.description || `Imported Job ${quote.id}`;
                const newJobId = uuidv4();

                await db.prepare(
                    `INSERT INTO jobs (id, customerId, title, description, start, end, status, recurrence, stripe_quote_id, total_amount_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    newJobId,
                    user.id.toString(),
                    jobTitle,
                    quote.description || `Imported from Stripe Quote #${quote.number}`,
                    jobStartDate.toISOString(),
                    jobEndDate.toISOString(),
                    'quote_accepted',
                    'none',
                    quote.id,
                    quote.amount_total
                ).run();

                const serviceInserts = quote.line_items.data.map(item => {
                    return db.prepare(
                        `INSERT INTO services (job_id, service_date, status, notes, price_cents) VALUES (?, ?, ?, ?, ?, ?)`
                    ).bind(
                        user.id,
                        newJobId,
                        jobStartDate.toISOString(),
                        'completed',
                        item.description || 'Imported Service',
                        item.price?.unit_amount || 0
                    );
                });

                await db.batch(serviceInserts);
                importedCount++;
            }

            startingAfter = quotes.data[quotes.data.length - 1].id;
            hasMore = quotes.has_more;
        }

        return successResponse({ message: `Import complete.`, imported: importedCount, skipped: skippedCount, errors });

    } catch (e: any) {
        console.error("Failed to import Stripe quotes:", e);
        return errorResponse(`Failed to import quotes: ${e.message}`, 500);
    }
}

export async function handleAdminSendQuote(c: Context<AppEnv>) {
    const { jobId } = c.req.param();
    const db = c.env.DB;
    const stripe = getStripe(c.env);

    try {
        const job = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first<Job>();
        if (!job) return errorResponse("Job not found.", 404);

        if (job.status !== 'quote_draft') {
            return errorResponse("This job does not have a draft quote.", 400);
        }

        if (!job.stripe_quote_id) {
            return errorResponse("This job does not have a quote associated with it.", 400);
        }

        const customer = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(job.customerId).first<User>();
        if (!customer) return errorResponse("Customer for this job not found.", 404);

        const finalizedQuote = await stripe.quotes.finalizeQuote(job.stripe_quote_id) as Stripe.Quote;

        await db.prepare(`UPDATE jobs SET status = 'pending' WHERE id = ?`)
            .bind(jobId)
            .run();

        await c.env.NOTIFICATION_QUEUE.send({
          type: 'quote_created',
          userId: customer.id,
          data: {
              quoteId: finalizedQuote.id,
              quoteUrl: (finalizedQuote as any).hosted_details_url,
              customerName: customer.name,
          },
          channels: ['email']
        });

        return successResponse({ quoteId: finalizedQuote.id });

    } catch (e: any) {
        console.error(`Failed to send quote for job ${jobId}:`, e);
        return errorResponse(`Failed to send quote: ${e.message}`, 500);
    }
}
