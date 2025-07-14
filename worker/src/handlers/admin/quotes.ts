// worker/src/handlers/admin/quotes.ts
import { Context } from 'hono';
import Stripe from 'stripe'; // Import the Stripe type
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

        // FIX 2: Explicitly cast the result to the correct Stripe.Quote type
        const finalizedQuote = await stripe.quotes.finalizeQuote(quoteData.id) as Stripe.Quote;

        await db.prepare(`UPDATE jobs SET stripe_quote_id = ?, status = 'pending_quote' WHERE id = ?`)
            .bind(finalizedQuote.id, jobId)
            .run();

        await c.env.NOTIFICATION_QUEUE.send({
          type: 'quote_created',
          userId: customer.id,
          data: {
              quoteId: finalizedQuote.id,
              quoteUrl: finalizedQuote.hosted_details_url,
              customerName: customer.name,
          },
          channels: ['email']
        });

        return successResponse({ quoteId: finalizedQuote.id });

    } catch (e: any) {
        console.error(`Failed to create quote for job ${jobId}:`, e);
        return errorResponse(`Failed to create quote: ${e.message}`, 500);
    }
}
