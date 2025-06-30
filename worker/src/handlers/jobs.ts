// worker/src/handlers/jobs.ts - CORRECTED
import { Context as HonoContext } from 'hono';
import { AppEnv as WorkerAppEnv } from '../index.js';
import { errorResponse as workerErrorResponse, successResponse as workerSuccessResponse } from '../utils.js';
import type { Job } from '@portal/shared';

// (handleGetJobs and handleGetJobById remain the same)

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

// FIX: This handler now correctly generates a public iCal feed from all jobs.
export const handleCalendarFeed = async (c: HonoContext<WorkerAppEnv>) => {
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE status != 'cancelled' ORDER BY start DESC`
        ).all<Job>();

        const jobs = results || [];

        const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '');
        const now = formatDate(new Date());

        let icalContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Gutter Portal//Public Job Calendar//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:All Jobs',
            'X-WR-TIMEZONE:UTC',
        ];

        for (const job of jobs) {
            icalContent.push(
                'BEGIN:VEVENT',
                `UID:${job.id}@gutterportal.com`,
                `DTSTAMP:${now}`,
                `DTSTART:${formatDate(new Date(job.start))}`,
                `DTEND:${formatDate(new Date(job.end))}`,
                `SUMMARY:${job.title}`,
                job.description ? `DESCRIPTION:${job.description.replace(/\n/g, '\\n')}` : '',
                `STATUS:${job.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`,
                'END:VEVENT'
            );
        }
        icalContent.push('END:VCALENDAR');

        return new Response(icalContent.join('\r\n'), {
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
