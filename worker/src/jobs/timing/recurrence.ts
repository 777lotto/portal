// worker/src/handlers/recurrence.ts
import { Context } from 'hono';
import { z } from 'zod';
import { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import type { Job } from '@portal/shared';

const RecurrenceRequestPayload = z.object({
  frequency: z.number().min(1),
  requested_day: z.number().min(0).max(6).optional(),
});

const RecurrenceUpdatePayload = z.object({
    status: z.enum(['accepted', 'declined', 'countered']),
    frequency: z.number().min(1).optional(),
    requested_day: z.number().min(0).max(6).optional(),
});

export const handleRequestRecurrence = async (c: Context<AppEnv>) => {
    const user = c.get('user');
    const { jobId } = c.req.param();
    const body = await c.req.json();
    const parsed = RecurrenceRequestPayload.safeParse(body);

    if (!parsed.success) {
        return errorResponse("Invalid data", 400, parsed.error.flatten());
    }

    const { frequency, requested_day } = parsed.data;

    try {
        const job = await c.env.DB.prepare(`SELECT * FROM jobs WHERE id = ? AND user_id = ?`).bind(jobId, user.id).first<Job>();
        if (!job) {
            return errorResponse("Job not found or you don't have permission to modify it.", 404);
        }

        // Create the recurrence request
        const { results } = await c.env.DB.prepare(
            `INSERT INTO job_recurrence_requests (job_id, user_id, frequency, requested_day) VALUES (?, ?, ?, ?) RETURNING id`
        ).bind(jobId, user.id, frequency, requested_day).all<{ id: number }>();

        if (!results || results.length === 0) {
            throw new Error("Failed to create recurrence request and get an ID.");
        }
        const requestId = results[0].id;

        // Notify admins
        const admins = await c.env.DB.prepare(`SELECT id FROM users WHERE role = 'admin'`).all<{ id: number }>();
        if (admins.results) {
            for (const admin of admins.results) {
                await c.env.NOTIFICATION_QUEUE.send({
                    type: 'recurrence_request_new',
                    user_id: admin.id,
                    data: {
                        requestId: requestId, // Pass the new ID
                        jobId: jobId,
                        jobTitle: job.title,
                        customerName: user.name,
                    },
                    channels: ['push', 'email']
                });
            }
        }

        return successResponse({ message: 'Recurrence request submitted successfully.' }, 201);
    } catch (e: any) {
        console.error(`Failed to create recurrence request for job ${jobId}:`, e);
        return errorResponse("Failed to submit recurrence request.", 500);
    }
};

export const handleGetRecurrenceRequests = async (c: Context<AppEnv>) => {
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT r.*, j.title as job_title, u.name as customer_name
             FROM job_recurrence_requests r
             JOIN jobs j ON r.job_id = j.id
             JOIN users u ON r.user_id = u.id
             WHERE r.status = 'pending'
             ORDER BY r.createdAt DESC`
        ).all();

        return successResponse(results || []);
    } catch (e: any) {
        console.error("Failed to get recurrence requests:", e);
        return errorResponse("Failed to retrieve recurrence requests.", 500);
    }
};

export const handleUpdateRecurrenceRequest = async (c: Context<AppEnv>) => {
    const { requestId } = c.req.param();
    const body = await c.req.json();
    const parsed = RecurrenceUpdatePayload.safeParse(body);

    if (!parsed.success) {
        return errorResponse("Invalid data", 400, parsed.error.flatten());
    }

    const { status, frequency, requested_day } = parsed.data;

    try {
        const request = await c.env.DB.prepare(`SELECT * FROM job_recurrence_requests WHERE id = ?`).bind(requestId).first<any>();
        if (!request) {
            return errorResponse("Request not found.", 404);
        }

        await c.env.DB.prepare(
            `UPDATE job_recurrence_requests SET status = ?, frequency = ?, requested_day = ?, updatedAt = ? WHERE id = ?`
        ).bind(
            status,
            frequency ?? request.frequency,
            requested_day ?? request.requested_day,
            new Date().toISOString(),
            requestId
        ).run();

        if (status === 'accepted') {
            const day = requested_day ?? request.requested_day;
            const byDayRule = (day !== null && day !== undefined)
                ? `;BYDAY=${['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][day]}`
                : '';

            const rrule = `FREQ=DAILY;INTERVAL=${frequency ?? request.frequency}${byDayRule}`;

            await c.env.DB.prepare(
                `UPDATE jobs SET recurrence = 'custom', rrule = ? WHERE id = ?`
            ).bind(rrule, request.job_id).run();
        }

        // Notify customer
        await c.env.NOTIFICATION_QUEUE.send({
            type: 'recurrence_request_response',
            user_id: request.user_id,
            data: {
                jobId: request.job_id,
                status: status,
            },
            channels: ['push']
        });

        return successResponse({ message: `Request ${status} successfully.` });
    } catch (e: any) {
        console.error(`Failed to update recurrence request ${requestId}:`, e);
        return errorResponse("Failed to update recurrence request.", 500);
    }
};

export const handleGetUnavailableRecurrenceDays = async (c: Context<AppEnv>) => {
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT rrule FROM jobs WHERE rrule IS NOT NULL`
        ).all<{ rrule: string }>();

        const unavailableDays = new Set<number>();
        const dayMap: { [key: string]: number } = { 'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6 };

        if(results) {
            for (const { rrule } of results) {
                const dayMatch = rrule.match(/BYDAY=([A-Z]{2})/);
                if (dayMatch && dayMatch[1]) {
                    unavailableDays.add(dayMap[dayMatch[1]]);
                }
            }
        }

        return successResponse({ unavailableDays: Array.from(unavailableDays) });
    } catch (e: any) {
        console.error("Failed to get unavailable recurrence days:", e);
        return errorResponse("Failed to retrieve unavailable recurrence days.", 500);
    }
}
