// worker/src/jobs/jobs.ts

import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { generateCalendarFeed } from './timing/calendar';
import { JobRecurrenceRequestSchema } from '@portal/shared';
import type { AppEnv } from '../server';
import { getUser } from '../auth/getUser';
import { DrizzleD1Database } from 'drizzle-orm/d1';

// Use the AppEnv with the authenticated user context
const factory = createFactory<AppEnv>();

/**
 * REFACTORED: Retrieves a list of jobs for the authenticated user.
 * - Assumes auth middleware provides the user object on c.get('user').
 * - Builds a Drizzle query dynamically based on user role.
 */
export const getJobs = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const database = db(c.env.DB);

    const conditions = [eq(schema.jobs.status, 'upcoming')];
    if (user.role !== 'admin') {
        conditions.push(eq(schema.jobs.userId, user.id.toString()));
    }

	const userJobs = await database.query.jobs.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.jobs.createdAt)]
    });

	return c.json({ jobs: userJobs });
});

/**
 * REFACTORED: Retrieves a single job by its ID, including its line items.
 * - Ensures the user is an admin or the job owner.
 * - Uses Drizzle's relational queries for cleaner data fetching.
 */
export const getJobById = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const { id } = c.req.param();
	const database = db(c.env.DB);

	const jobResult = await database.query.jobs.findFirst({
        where: eq(schema.jobs.id, id),
        with: {
            lineItems: true,
        }
    });

	if (!jobResult) {
		throw new HTTPException(404, { message: 'Job not found' });
	}

	if (user.role !== 'admin' && jobResult.userId !== user.id.toString()) {
		throw new HTTPException(403, { message: 'Access denied' });
	}

	return c.json({ job: jobResult });
});


/**
 * REFACTORED: Gets or creates a secret, unique URL for a user's iCal feed.
 * - Simplified Drizzle queries.
 */
export const getSecretCalendarUrl = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const database = db(c.env.DB);
	const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');

	let tokenRecord = await database.query.calendarTokens.findFirst({
        where: eq(schema.calendarTokens.userId, user.id)
    });

	if (!tokenRecord) {
		const [newRecord] = await database.insert(schema.calendarTokens).values({ token: uuidv4(), userId: user.id }).returning();
        tokenRecord = newRecord;
	}

	const url = `${portalBaseUrl}/api/public/calendar/feed/${tokenRecord.token}.ics`;
	return c.json({ url });
});

/**
 * REFACTORED: Invalidates the old iCal feed URL and generates a new one.
 * - Uses a transaction for atomicity.
 */
export const regenerateSecretCalendarUrl = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const database = db(c.env.DB);
	const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');

	const newToken = await database.transaction(async (tx: DrizzleD1Database<typeof schema>) => {
		await tx.delete(schema.calendarTokens).where(eq(schema.calendarTokens.userId, user.id));
		const [newRecord] = await tx.insert(schema.calendarTokens).values({ token: uuidv4(), userId: user.id }).returning();
		return newRecord.token;
	});

	const url = `${portalBaseUrl}/api/public/calendar/feed/${newToken}.ics`;
	return c.json({ url });
});

/**
 * REFACTORED: Generates and serves the iCal (.ics) file.
 * - Logic remains the same, but benefits from cleaner upstream code.
 */
export const handleCalendarFeed = factory.createHandlers(async (c) => {
	const { token } = c.req.param();
	const database = db(c.env.DB);

	const tokenRecord = await database.query.calendarTokens.findFirst({ where: eq(schema.calendarTokens.token, token) });

	if (!tokenRecord) {
		throw new HTTPException(404, { message: 'Calendar feed not found.' });
	}

	const icalContent = await generateCalendarFeed(c.env, tokenRecord.userId.toString());

	return new Response(icalContent, {
		headers: {
			'Content-Type': 'text/calendar; charset=utf-8',
			'Content-Disposition': `attachment; filename="jobs-user-${tokenRecord.userId}.ics"`,
		},
	});
});

/**
 * REFACTORED: Handler for a customer to request a recurrence for a job.
 * - Uses zValidator to ensure the payload is correct.
 */
export const requestRecurrence = factory.createHandlers(
    zValidator('json', JobRecurrenceRequestSchema.omit({ id: true, userId: true, status: true, createdAt: true, updatedAt: true })),
    async (c) => {
        const user = await getUser(c);
        const validatedData = c.req.valid('json');
        const database = db(c.env.DB);

        const [newRequest] = await database.insert(schema.jobRecurrenceRequests).values({
            ...validatedData,
            userId: user.id,
            status: 'pending'
        }).returning();

        return c.json({ success: true, message: 'Recurrence request submitted.', request: newRequest }, 201);
    }
);
