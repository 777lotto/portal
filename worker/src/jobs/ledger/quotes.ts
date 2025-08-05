import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db/client';
import * as schema from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { AppEnv } from '../../server';
import { getUser } from '../../auth/getUser';
import { DrizzleD1Database } from 'drizzle-orm/d1';

const factory = createFactory<AppEnv>();

/* ========================================================================
                        CUSTOMER-FACING QUOTE HANDLERS
   ======================================================================== */

/**
 * Retrieves a list of jobs with a 'pending' status for the user.
 * If the user is an admin, it retrieves all pending jobs.
 */
export const getQuotes = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const database = db(c.env.DB);

	const query = database
		.select({
			// Select specific fields to avoid exposing sensitive data
			id: schema.jobs.id,
			title: schema.jobs.title,
			status: schema.jobs.status,
			total_amount_cents: schema.jobs.totalAmountCents,
			createdAt: schema.jobs.createdAt,
			customerName: schema.users.name,
		})
		.from(schema.jobs)
		.leftJoin(schema.users, eq(schema.jobs.userId, schema.users.id.toString()))
		.where(eq(schema.jobs.status, 'pending'))
		.orderBy(desc(schema.jobs.createdAt));

	if (user.role !== 'admin') {
		// query.where(eq(schema.jobs.userId, user.id.toString()));
	}

	const pendingQuotes = await query;
	return c.json({ quotes: pendingQuotes });
});

/**
 * Retrieves a single job/quote by its ID, including line items.
 * Ensures the user is either an admin or the owner of the job.
 */
export const getQuote = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const { quoteId } = c.req.param();
	const database = db(c.env.DB);

	const job = await database.query.jobs.findFirst({ where: eq(schema.jobs.id, quoteId) });

	if (!job) {
		throw new HTTPException(404, { message: 'Quote not found.' });
	}

	// Security check
	if (user.role !== 'admin' && job.userId !== user.id.toString()) {
		throw new HTTPException(403, { message: 'Access denied.' });
	}

	const jobLineItems = await database.query.lineItems.findMany({ where: eq(schema.lineItems.jobId, quoteId) });

	return c.json({ quote: { ...job, lineItems: jobLineItems } });
});

/**
 * Updates a job's status to 'quote_declined'.
 */
export const declineQuote = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const { quoteId } = c.req.param();
	const database = db(c.env.DB);

	const job = await database.query.jobs.findFirst({ where: eq(schema.jobs.id, quoteId) });
	if (!job) {
		throw new HTTPException(404, { message: 'Quote not found.' });
	}
	if (user.role !== 'admin' && job.userId !== user.id.toString()) {
		throw new HTTPException(403, { message: 'Access denied.' });
	}

	await database.update(schema.jobs).set({ status: 'quote_declined' }).where(eq(schema.jobs.id, quoteId));

	return c.json({ success: true, message: 'Quote has been declined.' });
});

/**
 * Updates a job's status to 'quote_revised' and adds a note with the reason.
 */
export const requestQuoteRevision = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const { quoteId } = c.req.param();
	const { revisionReason } = await c.req.json(); // A Zod schema can be added for this

	if (!revisionReason) {
		throw new HTTPException(400, { message: 'Revision reason is required.' });
	}

	const database = db(c.env.DB);

	const job = await database.query.jobs.findFirst({ where: eq(schema.jobs.id, quoteId) });
	if (!job) {
		throw new HTTPException(404, { message: 'Quote not found.' });
	}
	if (user.role !== 'admin' && job.userId !== user.id.toString()) {
		throw new HTTPException(403, { message: 'Access denied.' });
	}

	// Use a transaction to ensure both operations succeed
	await database.transaction(async (tx: DrizzleD1Database<typeof schema>) => {
		await tx.update(schema.jobs).set({ status: 'quote_revised' }).where(eq(schema.jobs.id, quoteId));
		await tx.insert(schema.notes).values({
			jobId: quoteId,
			userId: user.id,
			content: `Quote revision requested: ${revisionReason}`,
		});
	});

	return c.json({ success: true, message: 'Quote revision has been requested.' });
});
