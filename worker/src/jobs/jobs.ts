import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { jobs, lineItems, users, calendarTokens, calendarEvents } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getStripe } from '../../stripe';
import { generateCalendarFeed } from './timing/calendar';
import type { User } from '@portal/shared';

const factory = createFactory();

// A middleware to get the authenticated user's full profile from the DB.
// This is useful for many handlers in this file.
const userMiddleware = factory.createMiddleware(async (c, next) => {
	const auth = c.get('clerkUser'); // Assuming clerkAuth middleware is used upstream
	if (!auth?.id) {
		throw new HTTPException(401, { message: 'Unauthorized' });
	}

	const database = db(c.env.DB);
	const user = await database.select().from(users).where(eq(users.clerk_id, auth.id)).get();

	if (!user) {
		throw new HTTPException(401, { message: 'User not found in database.' });
	}
	c.set('user', user);
	await next();
});

/* ========================================================================
                        CUSTOMER-FACING JOB HANDLERS
   ======================================================================== */

/**
 * Retrieves a list of "upcoming" jobs for the authenticated user.
 * If the user is an admin, it retrieves all upcoming jobs.
 */
export const getJobs = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const database = db(c.env.DB);

	const query = database.select().from(jobs).where(eq(jobs.status, 'upcoming')).orderBy(desc(jobs.createdAt));

	// If the user is not an admin, filter jobs by their user ID.
	if (user.role !== 'admin') {
		query.where(eq(jobs.user_id, user.id.toString()));
	}

	const userJobs = await query.all();

	return c.json({ jobs: userJobs });
});

/**
 * Retrieves a single job by its ID, including its line items.
 * Ensures the user is either an admin or the owner of the job.
 */
export const getJobById = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const { id } = c.req.param();
	const database = db(c.env.DB);

	// Fetch the job and its line items in a single transaction for efficiency
	const jobResult = await database.transaction(async (tx) => {
		const job = await tx.select().from(jobs).where(eq(jobs.id, id)).get();
		if (!job) return null;

		const items = await tx.select().from(lineItems).where(eq(lineItems.job_id, id)).all();
		return { ...job, lineItems: items };
	});

	if (!jobResult) {
		throw new HTTPException(404, { message: 'Job not found' });
	}

	// Security check: only admins or the job owner can view it
	if (user.role !== 'admin' && jobResult.user_id !== user.id.toString()) {
		throw new HTTPException(403, { message: 'Access denied' });
	}

	return c.json({ job: jobResult });
});

/* ========================================================================
                        CALENDAR & ICAL FEED HANDLERS
   ======================================================================== */

/**
 * Gets or creates a secret, unique URL for a user's iCal feed.
 */
export const getSecretCalendarUrl = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const database = db(c.env.DB);
	const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');

	let tokenRecord = await database.select().from(calendarTokens).where(eq(calendarTokens.user_id, user.id)).get();

	if (!tokenRecord) {
		const newToken = uuidv4();
		[tokenRecord] = await database.insert(calendarTokens).values({ token: newToken, user_id: user.id }).returning();
	}

	const url = `${portalBaseUrl}/api/public/calendar/feed/${tokenRecord.token}.ics`;
	return c.json({ url });
});

/**
 * Invalidates the old iCal feed URL and generates a new one.
 */
export const regenerateSecretCalendarUrl = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const database = db(c.env.DB);
	const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');

	// Perform delete and insert in a transaction to ensure atomicity
	const newToken = await database.transaction(async (tx) => {
		await tx.delete(calendarTokens).where(eq(calendarTokens.user_id, user.id));
		const [newRecord] = await tx.insert(calendarTokens).values({ token: uuidv4(), user_id: user.id }).returning();
		return newRecord.token;
	});

	const url = `${portalBaseUrl}/api/public/calendar/feed/${newToken}.ics`;
	return c.json({ url });
});

/**
 * Generates and serves the iCal (.ics) file for a given secret token.
 * (This handler would be used in a public route, not a protected one).
 */
export const handleCalendarFeed = factory.createHandlers(async (c) => {
	const { token } = c.req.param();
	const database = db(c.env.DB);

	const tokenRecord = await database.select().from(calendarTokens).where(eq(calendarTokens.token, token)).get();

	if (!tokenRecord) {
		throw new HTTPException(404, { message: 'Calendar feed not found.' });
	}

	// The generateCalendarFeed function is assumed to be refactored to use Drizzle as well
	const icalContent = await generateCalendarFeed(c.env, tokenRecord.user_id.toString());

	return new Response(icalContent, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': `attachment; filename="jobs-user-${tokenRecord.user_id}.ics"`,
		},
	});
});

/**
 * Handler for a customer to request a recurrence for a job.
 * REFACTORED: Assumes the payload is validated by middleware.
 */
export const requestRecurrence = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const validatedData = c.req.valid('json'); // Zod schema should be applied in the route definition
	const database = db(c.env.DB);

	// TODO: Add logic to insert the recurrence request into the database.
	// Example:
	// const [newRequest] = await database.insert(jobRecurrenceRequests).values({
	//   ...validatedData,
	//   user_id: user.id,
	//   status: 'pending'
	// }).returning();

	console.log('Recurrence request received:', { ...validatedData, user_id: user.id });

	// Placeholder response
	return c.json({ success: true, message: 'Recurrence request submitted.' }, 201);
});
