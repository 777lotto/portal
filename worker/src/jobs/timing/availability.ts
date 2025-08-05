import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db/client';
import * as schema from '../../db/schema';
import { eq, or } from 'drizzle-orm';
import type { AppEnv } from '../../server';
import { getUser } from '../../auth/getUser';

const factory = createFactory<AppEnv>();

/* ========================================================================
                        CUSTOMER AVAILABILITY HANDLER
   ======================================================================== */

/**
 * Retrieves a customer's availability, categorizing days as booked, pending, or blocked.
 */
export const getAvailability = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const database = db(c.env.DB);

	// Fetch all of a user's job events and any globally blocked-off days.
	const events = await database
		.select({
			start: schema.calendarEvents.start,
			type: schema.calendarEvents.type,
			status: schema.jobs.status,
		})
		.from(schema.calendarEvents)
		.leftJoin(schema.jobs, eq(schema.calendarEvents.jobId, schema.jobs.id))
		.where(or(eq(schema.calendarEvents.userId, user.id), eq(schema.calendarEvents.type, 'blocked')))

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
