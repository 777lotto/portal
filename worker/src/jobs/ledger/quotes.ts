import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../../db';
import { jobs, lineItems, notes, users } from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { User } from '@portal/shared';

const factory = createFactory();

// Middleware to get the authenticated user's full profile from the DB.
const userMiddleware = factory.createMiddleware(async (c, next) => {
	const auth = c.get('clerkUser');
	if (!auth?.id) {
		throw new HTTPException(401, { message: 'Unauthorized' });
	}
	const database = db(c.env.DB);
	const user = await database.select().from(users).where(eq(users.clerk_id, auth.id)).get();
	if (!user) {
		throw new HTTPException(401, { message: 'User not found.' });
	}
	c.set('user', user);
	await next();
});

/* ========================================================================
                        CUSTOMER-FACING QUOTE HANDLERS
   ======================================================================== */

/**
 * Retrieves a list of jobs with a 'pending' status for the user.
 * If the user is an admin, it retrieves all pending jobs.
 */
export const getQuotes = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const database = db(c.env.DB);

	const query = database
		.select({
			// Select specific fields to avoid exposing sensitive data
			id: jobs.id,
			title: jobs.title,
			status: jobs.status,
			total_amount_cents: jobs.total_amount_cents,
			createdAt: jobs.createdAt,
			customerName: users.name,
		})
		.from(jobs)
		.leftJoin(users, eq(jobs.user_id, users.id.toString()))
		.where(eq(jobs.status, 'pending'))
		.orderBy(desc(jobs.createdAt));

	if (user.role !== 'admin') {
		query.where(eq(jobs.user_id, user.id.toString()));
	}

	const pendingQuotes = await query.all();
	return c.json({ quotes: pendingQuotes });
});

/**
 * Retrieves a single job/quote by its ID, including line items.
 * Ensures the user is either an admin or the owner of the job.
 */
export const getQuote = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const { quoteId } = c.req.param();
	const database = db(c.env.DB);

	const job = await database.select().from(jobs).where(eq(jobs.id, quoteId)).get();

	if (!job) {
		throw new HTTPException(404, { message: 'Quote not found.' });
	}

	// Security check
	if (user.role !== 'admin' && job.user_id !== user.id.toString()) {
		throw new HTTPException(403, { message: 'Access denied.' });
	}

	const jobLineItems = await database.select().from(lineItems).where(eq(lineItems.job_id, quoteId)).all();

	return c.json({ quote: { ...job, lineItems: jobLineItems } });
});

/**
 * Updates a job's status to 'quote_declined'.
 */
export const declineQuote = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const { quoteId } = c.req.param();
	const database = db(c.env.DB);

	const job = await database.select({ user_id: jobs.user_id }).from(jobs).where(eq(jobs.id, quoteId)).get();
	if (!job) {
		throw new HTTPException(404, { message: 'Quote not found.' });
	}
	if (user.role !== 'admin' && job.user_id !== user.id.toString()) {
		throw new HTTPException(403, { message: 'Access denied.' });
	}

	await database.update(jobs).set({ status: 'quote_declined' }).where(eq(jobs.id, quoteId));

	return c.json({ success: true, message: 'Quote has been declined.' });
});

/**
 * Updates a job's status to 'quote_revised' and adds a note with the reason.
 */
export const requestQuoteRevision = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const { quoteId } = c.req.param();
	const { revisionReason } = await c.req.json(); // A Zod schema can be added for this

	if (!revisionReason) {
		throw new HTTPException(400, { message: 'Revision reason is required.' });
	}

	const database = db(c.env.DB);

	const job = await database.select({ user_id: jobs.user_id }).from(jobs).where(eq(jobs.id, quoteId)).get();
	if (!job) {
		throw new HTTPException(404, { message: 'Quote not found.' });
	}
	if (user.role !== 'admin' && job.user_id !== user.id.toString()) {
		throw new HTTPException(403, { message: 'Access denied.' });
	}

	// Use a transaction to ensure both operations succeed
	await database.transaction(async (tx) => {
		await tx.update(jobs).set({ status: 'quote_revised' }).where(eq(jobs.id, quoteId));
		await tx.insert(notes).values({
			job_id: quoteId,
			user_id: user.id,
			content: `Quote revision requested: ${revisionReason}`,
		});
	});

	return c.json({ success: true, message: 'Quote revision has been requested.' });
});
