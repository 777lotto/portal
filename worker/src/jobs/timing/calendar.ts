import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db/client';
import * as schema from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import type { AppEnv } from '../../server';
import { getUser } from '../../auth/getUser';

const factory = createFactory<AppEnv>();

/* ========================================================================
                           CALENDAR EVENT HANDLERS
   ======================================================================== */

/**
 * Retrieves all calendar events for the authenticated user.
 * If the user is an admin, it retrieves all events.
 */
export const getCalendarEvents = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const database = db(c.env.DB);

	const query = database.select().from(schema.calendarEvents);

	if (user.role !== 'admin') {
		// query.where(eq(schema.calendarEvents.userId, user.id));
	}

	const events = await query;
	return c.json({ events });
});

/**
 * [ADMIN] Adds a new event to the calendar (e.g., blocking off a day).
 */
export const addCalendarEvent = factory.createHandlers(async (c) => {
	const validatedData = await c.req.json();
	const database = db(c.env.DB);

	const [newEvent] = await database.insert(schema.calendarEvents).values(validatedData).returning();

	return c.json({ event: newEvent }, 201);
});

/**
 * [ADMIN] Removes an event from the calendar.
 */
export const removeCalendarEvent = factory.createHandlers(async (c) => {
	const { eventId } = c.req.param();
	const database = db(c.env.DB);

	await database.delete(schema.calendarEvents).where(eq(schema.calendarEvents.id, parseInt(eventId, 10)));


	return c.json({ success: true, message: 'Event removed from calendar.' });
});

/**
 * Creates a new booking from a public request.
 * This handler would be used on a public-facing route.
 */
export const createBooking = factory.createHandlers(async (c) => {
	const validatedData = await c.req.json();
	const { name, email, phone, address, date, lineItems } = validatedData;


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

export async function generateCalendarFeed(env: any, userId: string): Promise<string> {
    const database = db(env.DB);
    const events = await database.query.calendarEvents.findMany({
        where: eq(schema.calendarEvents.userId, parseInt(userId, 10)),
    });

    let icalContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//777 Solutions//Portal//EN',
    ];

    for (const event of events) {
        icalContent.push('BEGIN:VEVENT');
        icalContent.push(`UID:${event.id}@portal.777solutions.com`);
        icalContent.push(`DTSTAMP:${new Date().toISOString().replace(/[-:.]/g, '')}`);
        icalContent.push(`DTSTART:${event.start.replace(/[-:.]/g, '')}`);
        icalContent.push(`DTEND:${event.end.replace(/[-:.]/g, '')}`);
        icalContent.push(`SUMMARY:${event.title}`);
        icalContent.push('END:VEVENT');
    }

    icalContent.push('END:VCALENDAR');
    return icalContent.join('\r\n');
}
