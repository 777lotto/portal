// worker/src/handlers/jobs.ts
// --------------------------------------
import { Context as HonoContext } from 'hono';
import { AppEnv as WorkerAppEnv } from '../index';
import { errorResponse as workerErrorResponse, successResponse as workerSuccessResponse } from '../utils';
import { generateIcs } from '../calendar';

export const handleGetJobs = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE customerId = ? ORDER BY start DESC`
        ).bind(user.id.toString()).all();
        return workerSuccessResponse(results);
    } catch (e: any) {
        console.error("Failed to get jobs:", e.message);
        return workerErrorResponse("Failed to retrieve jobs", 500);
    }
};

export const handleGetJobById = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const { id } = c.req.param();
    try {
        const job = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE id = ? AND customerId = ?`
        ).bind(id, user.id.toString()).first();

        if (!job) {
            return workerErrorResponse("Job not found", 404);
        }
        return workerSuccessResponse(job);
    } catch (e: any) {
        console.error(`Failed to get job ${id}:`, e.message);
        return workerErrorResponse("Failed to retrieve job", 500);
    }
};

export const handleCalendarFeed = async (c: HonoContext<WorkerAppEnv>) => {
    // This could be enhanced to use a secret token in the URL for security
    try {
        const { results: jobs } = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE status != 'cancelled' ORDER BY start DESC`
        ).all();

        const icsContent = generateIcs(jobs as any[]);
        return new Response(icsContent, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'attachment; filename="jobs.ics"',
            }
        });
    } catch (e: any) {
        console.error("Failed to generate calendar feed:", e);
        return workerErrorResponse("Could not generate calendar feed.", 500);
    }
};
