import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../../db';
import { calendarEvents, jobs, users } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
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
                           CALENDAR EVENT HANDLERS
   ======================================================================== */

/**
 * Retrieves all calendar events for the authenticated user.
 * If the user is an admin, it retrieves all events.
 */
export const getCalendarEvents = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const database = db(c.env.DB);

	const query = database.select().from(calendarEvents);

	if (user.role !== 'admin') {
		query.where(eq(calendarEvents.user_id, user.id));
	}

	const events = await query.all();
	return c.json({ events });
});

/**
 * [ADMIN] Adds a new event to the calendar (e.g., blocking off a day).
 */
export const addCalendarEvent = factory.createHandlers(async (c) => {
	const validatedData = c.req.valid('json'); // Assumes a Zod schema is used on the route
	const database = db(c.env.DB);

	const [newEvent] = await database.insert(calendarEvents).values(validatedData).returning();

	return c.json({ event: newEvent }, 201);
});

/**
 * [ADMIN] Removes an event from the calendar.
 */
export const removeCalendarEvent = factory.createHandlers(async (c) => {
	const { eventId } = c.req.param();
	const database = db(c.env.DB);

	const result = await database.delete(calendarEvents).where(eq(calendarEvents.id, parseInt(eventId, 10)));

	if (result.rowCount === 0) {
		throw new HTTPException(404, { message: 'Calendar event not found.' });
	}

	return c.json({ success: true, message: 'Event removed from calendar.' });
});

/**
 * Creates a new booking from a public request.
 * This handler would be used on a public-facing route.
 */
export const createBooking = factory.createHandlers(async (c) => {
	const validatedData = c.req.valid('json'); // Assumes PublicBookingRequestSchema is used
	const { name, email, phone, address, date, lineItems } = validatedData;
	const database = db(c.env.DB);

	// This is a simplified booking process. A real-world scenario might involve:
	// 1. Checking for an existing user with that email/phone.
	// 2. Creating a new user if one doesn't exist.
	// 3. Creating a job with a 'pending' or 'quote_draft' status.
	// 4. Creating a calendar event.
	// 5. Sending notifications.

	console.log('New booking request received:', validatedData);

	// For now, we'll just acknowledge the request.
	// The full implementation would involve database inserts similar to `createJob`.

	return c.json({ success: true, message: 'Your booking request has been received. We will contact you shortly.' }, 201);
});
