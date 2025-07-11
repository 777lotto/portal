// worker/src/handlers/jobs.ts - CORRECTED
import { Context as HonoContext } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid'; // MODIFIED: Import uuid
import { AppEnv as WorkerAppEnv } from '../index.js';
import { errorResponse as workerErrorResponse, successResponse as workerSuccessResponse } from '../utils.js';
import { generateCalendarFeed, createJob } from '../calendar.js';
import type { Job } from '@portal/shared';

const BlockDatePayload = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  reason: z.string().optional().nullable(),
});

// --- NEW: Calendar URL Handlers ---

export const handleGetSecretCalendarUrl = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');

    try {
        let tokenRecord = await c.env.DB.prepare(
            `SELECT token FROM calendar_tokens WHERE user_id = ?`
        ).bind(user.id).first<{ token: string }>();

        if (!tokenRecord) {
            const newToken = uuidv4();
            await c.env.DB.prepare(
                `INSERT INTO calendar_tokens (token, user_id) VALUES (?, ?)`
            ).bind(newToken, user.id).run();
            tokenRecord = { token: newToken };
        }

        const url = `${portalBaseUrl}/api/public/calendar/feed/${tokenRecord.token}.ics`;
        return workerSuccessResponse({ url });

    } catch (e: any) {
        console.error(`Failed to get or create calendar token for user ${user.id}:`, e);
        return workerErrorResponse("Could not retrieve calendar URL.", 500);
    }
};

export const handleRegenerateSecretCalendarUrl = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');

    try {
        // Delete old token
        await c.env.DB.prepare(
            `DELETE FROM calendar_tokens WHERE user_id = ?`
        ).bind(user.id).run();

        // Create new token
        const newToken = uuidv4();
        await c.env.DB.prepare(
            `INSERT INTO calendar_tokens (token, user_id) VALUES (?, ?)`
        ).bind(newToken, user.id).run();

        const url = `${portalBaseUrl}/api/public/calendar/feed/${newToken}.ics`;
        return workerSuccessResponse({ url });

    } catch (e: any) {
         console.error(`Failed to regenerate calendar token for user ${user.id}:`, e);
        return workerErrorResponse("Could not regenerate calendar URL.", 500);
    }
};


export const handleCreateJob = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const body = await c.req.json();

    try {
        const newJob = await createJob(c.env, body, user.id.toString());
        return workerSuccessResponse(newJob, 201);
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return workerErrorResponse("Invalid job data provided.", 400, e.flatten());
        }
        console.error("Failed to create job:", e);
        return workerErrorResponse("Failed to create job.", 500);
    }
};

export const handleGetJobs = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    try {
        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE customerId = ? ORDER BY start DESC`
        ).bind(user.id.toString()).all<Job>();

        const jobs = dbResponse?.results || [];
        return workerSuccessResponse(jobs);
    } catch (e: any) {
        return workerErrorResponse("Failed to retrieve jobs", 500);
    }
};

export const handleGetJobById = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const { id } = c.req.param();
    try {
        const job = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE id = ? AND customerId = ?`
        ).bind(id, user.id.toString()).first<Job>();

        if (!job) {
            return workerErrorResponse("Job not found", 404);
        }
        return workerSuccessResponse(job);
    } catch (e: any) {
        return workerErrorResponse("Failed to retrieve job", 500);
    }
};

export const handleCalendarFeed = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    try {
        const icalContent = await generateCalendarFeed(c.env, user.id.toString());
        return new Response(icalContent, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': `attachment; filename="jobs-user-${user.id}.ics"`,
            }
        });
    } catch (e: any) {
        console.error("Failed to generate calendar feed:", e);
        return workerErrorResponse("Could not generate calendar feed.", 500);
    }
};

// --- NEW Admin Handlers for Blocked Dates ---

export async function handleGetBlockedDates(c: HonoContext<WorkerAppEnv>) {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT date, reason FROM blocked_dates ORDER BY date ASC`
    ).all<{ date: string, reason: string }>();
    return workerSuccessResponse(results || []);
  } catch (e: any) {
    console.error("Error fetching blocked dates:", e);
    return workerErrorResponse('Failed to fetch blocked dates.', 500);
  }
}

export async function handleAddBlockedDate(c: HonoContext<WorkerAppEnv>) {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = BlockDatePayload.safeParse(body);

  if (!parsed.success) {
    return workerErrorResponse("Invalid data", 400, parsed.error.flatten());
  }

  const { date, reason } = parsed.data;

  try {
    await c.env.DB.prepare(
      `INSERT INTO blocked_dates (date, reason, user_id) VALUES (?, ?, ?)`
    ).bind(date, reason || null, user.id).run();
    return workerSuccessResponse({ date, reason }, 201);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint failed')) {
      return workerErrorResponse("This date is already blocked.", 409);
    }
    console.error("Error adding blocked date:", e);
    return workerErrorResponse('Failed to block date.', 500);
  }
}

export async function handleRemoveBlockedDate(c: HonoContext<WorkerAppEnv>) {
  const { date } = c.req.param();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return workerErrorResponse("Invalid date format in URL. Use YYYY-MM-DD.", 400);
  }

  try {
    const { success } = await c.env.DB.prepare(
      `DELETE FROM blocked_dates WHERE date = ?`
    ).bind(date).run();

    if (!success) {
      return workerErrorResponse('Failed to unblock date.', 500);
    }
    return workerSuccessResponse({ message: `Date ${date} has been unblocked.` });
  } catch (e: any) {
    console.error("Error removing blocked date:", e);
    return workerErrorResponse('Failed to unblock date.', 500);
  }
}
