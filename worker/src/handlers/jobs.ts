// worker/src/handlers/jobs.ts - CORRECTED
import { Context as HonoContext } from 'hono';
import { z } from 'zod'; // <--- ADDED: Import z from zod
import { AppEnv as WorkerAppEnv } from '../index.js';
import { errorResponse as workerErrorResponse, successResponse as workerSuccessResponse } from '../utils.js';
import { generateCalendarFeed, createJob } from '../calendar.js';
import type { Job } from '@portal/shared';
// REMOVED: Unused import for JobSchema

// --- NEW: Handler to create a new job ---
export const handleCreateJob = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const body = await c.req.json();

    try {
        const newJob = await createJob(c.env, body, user.id.toString());
        return workerSuccessResponse(newJob, 201);
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            // This will now work correctly after we update the errorResponse function
            return workerErrorResponse("Invalid job data provided.", 400, e.flatten());
        }
        console.error("Failed to create job:", e);
        return workerErrorResponse("Failed to create job.", 500);
    }
};

export const handleGetJobs = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE customerId = ? ORDER BY start DESC`
        ).bind(user.id.toString()).all<Job>();
        return workerSuccessResponse(results);
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
