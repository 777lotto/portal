import { Context } from 'hono';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import { getStripe } from '../../stripe.js';
import type { Job, LineItem, User } from '@portal/shared';

export async function handleAdminCreateQuote(c: Context<AppEnv>) {
    const db = c.env.DB;
    const stripe = c.env.STRIPE;
    const body = await c.req.json();
    const { user_id, title, description, lineItems } = body;

    if (!user_id || !title || !lineItems) {
        return errorResponse('Missing required fields', 400);
    }

    try {
        const quote = await createStripeQuote(stripe, user_id, lineItems);

        await db.prepare(
            `INSERT INTO quotes (id, user_id, title, description, stripe_quote_id, status)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
            crypto.randomUUID(),
            user_id,
            title,
            description,
            quote.id,
            'sent'
        ).run();

        return c.json({ message: 'Quote created successfully', quoteId: quote.id }, 201);
    } catch (e: any) {
        console.error('Failed to create quote:', e);
        return errorResponse('An internal error occurred while creating the quote: ' + e.message, 500);
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
                    const stripeCustomer = quote.customer as Stripe.Customer;
                    const { name, email, phone } = stripeCustomer;
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

                const jobTitle = quote.line_items.data[0]?.description || `Imported Job ${quote.id}`;
                const newJobId = uuidv4();

                await db.prepare(
                    `INSERT INTO jobs (id, user_id, title, description, status, recurrence, stripe_quote_id, total_amount_cents, due) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    newJobId,
                    user.id,
                    jobTitle,
                    quote.description || `Imported from Stripe Quote #${quote.number}`,
                    'pending',
                    'none',
                    quote.id,
                    quote.amount_total,
                    quote.expires_at ? new Date(quote.expires_at * 1000).toISOString() : null
                ).run();

                const lineItemInserts = quote.line_items.data.map(item => {
                    return db.prepare(
                        `INSERT INTO line_items (job_id, description, quantity, unit_total_amount_cents) VALUES (?, ?, ?, ?)`
                    ).bind(
                        newJobId,
                        item.description || 'Imported Item',
                        item.quantity || 1,
                        item.price?.unit_amount || 0
                    );
                });

                await db.batch(lineItemInserts);
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

        const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(job.user_id).first<User>();
        if (!user) return errorResponse("User for this job not found.", 404);

        const finalizedQuote = await stripe.quotes.finalizeQuote(job.stripe_quote_id) as Stripe.Quote;

        await db.prepare(`UPDATE jobs SET status = 'pending' WHERE id = ?`)
            .bind(jobId)
            .run();

        await c.env.NOTIFICATION_QUEUE.send({
          type: 'quote_created',
          user_id: user.id,
          data: {
              quoteId: finalizedQuote.id,
              quoteUrl: (finalizedQuote as any).hosted_details_url,
              customerName: user.name,
          },
          channels: ['email']
        });

        return successResponse({ quoteId: finalizedQuote.id });

    } catch (e: any) {
        console.error(`Failed to send quote for job ${jobId}:`, e);
        return errorResponse(`Failed to send quote: ${e.message}`, 500);
    }
}
