// worker/src/jobs/admin/quotes.ts

import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db/client';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';
import { getStripe, createStripeQuote } from '../../stripe';
import type { AppEnv } from '../../server';

const factory = createFactory<AppEnv>();

/**
 * REFACTORED: Creates a Stripe quote from a job in the local database.
 * - Uses Drizzle's relational queries to fetch job with line items.
 * - Throws specific HTTP exceptions for clear error handling.
 */
export const createQuote = factory.createHandlers(async (c) => {
	const { jobId } = c.req.param();
	const database = db(c.env.DB);
	const stripe = getStripe(c.env);

	const job = await database.query.jobs.findFirst({
        where: eq(schema.jobs.id, jobId),
        with: {
            lineItems: true,
            user: {
                columns: {
                    stripeCustomerId: true,
                }
            }
        }
    });

	if (!job) {
		throw new HTTPException(404, { message: 'Job not found.' });
	}
	if (!job.user?.stripeCustomerId) {
		throw new HTTPException(404, { message: 'User or Stripe customer ID not found.' });
	}
	if (job.lineItems.length === 0) {
		throw new HTTPException(400, { message: 'Cannot create a quote for a job with no line items.' });
	}

	const quote = await createStripeQuote(stripe, job.user.stripeCustomerId, job.lineItems);

	await database.update(schema.jobs).set({ stripeQuoteId: quote.id, status: 'quote_sent' }).where(eq(schema.jobs.id, jobId));

	return c.json({ quote });
});

/**
 * REFACTORED: Finalizes and sends a draft quote associated with a job.
 * - Uses Drizzle to fetch job and user data.
 * - Enqueues a notification upon successful finalization.
 */
export const sendQuote = factory.createHandlers(async (c) => {
	const { jobId } = c.req.param();
	const database = db(c.env.DB);
	const stripe = getStripe(c.env);

	const job = await database.query.jobs.findFirst({
        where: eq(schema.jobs.id, jobId),
        with: { user: true }
    });

	if (!job) {
		throw new HTTPException(404, { message: 'Job not found.' });
	}
	if (job.status !== 'quote_draft' || !job.stripeQuoteId) {
		throw new HTTPException(400, { message: 'Job does not have a draft quote associated with it.' });
	}
    if (!job.user) {
        throw new HTTPException(404, { message: 'User for this job not found.' });
    }

	const finalizedQuote = await stripe.quotes.finalizeQuote(job.stripeQuoteId);

	await database.update(schema.jobs).set({ status: 'pending' }).where(eq(schema.jobs.id, jobId));

	await c.env.NOTIFICATION_QUEUE.send({
		type: 'quote_created',
		user_id: job.user.id,
		data: {
			quoteId: finalizedQuote.id,
			quoteUrl: (finalizedQuote as any).hosted_details_url,
			customerName: job.user.name,
		},
		channels: ['email'],
	});

	return c.json({ quote: finalizedQuote });
});
