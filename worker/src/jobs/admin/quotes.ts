import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import Stripe from 'stripe';
import { db } from '../../../db';
import { jobs, lineItems, users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { getStripe, createStripeQuote } from '../../../stripe';

const factory = createFactory();

/* ========================================================================
                           ADMIN QUOTE HANDLERS
   ======================================================================== */

/**
 * Creates a Stripe quote from a job in the local database.
 */
export const createQuote = factory.createHandlers(async (c) => {
	const { jobId } = c.req.param();
	const database = db(c.env.DB);
	const stripe = getStripe(c.env);

	const job = await database.select().from(jobs).where(eq(jobs.id, jobId)).get();
	if (!job) {
		throw new HTTPException(404, { message: 'Job not found.' });
	}

	const user = await database.select().from(users).where(eq(users.id, parseInt(job.user_id, 10))).get();
	if (!user?.stripe_customer_id) {
		throw new HTTPException(404, { message: 'User or Stripe customer ID not found.' });
	}

	const jobLineItems = await database.select().from(lineItems).where(eq(lineItems.job_id, jobId)).all();
	if (jobLineItems.length === 0) {
		throw new HTTPException(400, { message: 'Cannot create a quote for a job with no line items.' });
	}

	const quote = await createStripeQuote(stripe, user.stripe_customer_id, jobLineItems);

	// Update the job with the new quote ID and status
	await database.update(jobs).set({ stripe_quote_id: quote.id, status: 'quote_sent' }).where(eq(jobs.id, jobId));

	return c.json({ quote });
});

/**
 * Finalizes and sends a draft quote that is associated with a job.
 */
export const sendQuote = factory.createHandlers(async (c) => {
	const { jobId } = c.req.param();
	const database = db(c.env.DB);
	const stripe = getStripe(c.env);

	const job = await database.select().from(jobs).where(eq(jobs.id, jobId)).get();
	if (!job) {
		throw new HTTPException(404, { message: 'Job not found.' });
	}
	if (job.status !== 'quote_draft' || !job.stripe_quote_id) {
		throw new HTTPException(400, { message: 'Job does not have a draft quote associated with it.' });
	}

	const user = await database.select().from(users).where(eq(users.id, parseInt(job.user_id, 10))).get();
	if (!user) {
		throw new HTTPException(404, { message: 'User for this job not found.' });
	}

	const finalizedQuote = await stripe.quotes.finalizeQuote(job.stripe_quote_id);

	await database.update(jobs).set({ status: 'pending' }).where(eq(jobs.id, jobId));

	// Enqueue a notification for the user
	await c.env.NOTIFICATION_QUEUE.send({
		type: 'quote_created',
		user_id: user.id,
		data: {
			quoteId: finalizedQuote.id,
			quoteUrl: (finalizedQuote as any).hosted_details_url, // URL is available after finalization
			customerName: user.name,
		},
		channels: ['email'],
	});

	return c.json({ quote: finalizedQuote });
});
