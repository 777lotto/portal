import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../../db';
import { calendarEvents, jobs, users } from '../../../db/schema';
import { eq, or } from 'drizzle-orm';
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
                        CUSTOMER AVAILABILITY HANDLER
   ======================================================================== */

/**
 * Retrieves a customer's availability, categorizing days as booked, pending, or blocked.
 */
export const getAvailability = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const database = db(c.env.DB);

	// Fetch all of a user's job events and any globally blocked-off days.
	const events = await database
		.select({
			start: calendarEvents.start,
			type: calendarEvents.type,
			status: jobs.status,
		})
		.from(calendarEvents)
		.leftJoin(jobs, eq(calendarEvents.job_id, jobs.id))
		.where(or(eq(calendarEvents.user_id, user.id), eq(calendarEvents.type, 'blocked')))
		.all();

	const bookedDays = new Set<string>();
	const pendingDays = new Set<string>();
	const blockedDates = new Set<string>();

	for (const event of events) {
		const day = event.start.split('T')[0];

		if (event.type === 'blocked') {
			blockedDates.add(day);
		} else if (event.type === 'job') {
			if (event.status === 'pending' || event.status === 'quote_sent') {
				pendingDays.add(day);
			} else if (event.status && !['canceled', 'complete', 'quote_draft', 'invoice_draft'].includes(event.status)) {
				// Any other active job status means the day is booked.
				bookedDays.add(day);
			}
		}
	}

	return c.json({
		availability: {
			bookedDays: Array.from(bookedDays),
			pendingDays: Array.from(pendingDays),
			blockedDates: Array.from(blockedDates),
		},
	});
});
