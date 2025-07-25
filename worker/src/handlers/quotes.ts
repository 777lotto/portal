import { Context } from 'hono';
import { AppEnv } from '../index.js';
import { errorResponse, successResponse } from '../utils.js';
import type { Job } from '@portal/shared';

export async function getPendingQuotes(c: Context<AppEnv>) {
    const user = c.get('user');
    const env = c.env;

    let jobs;
    if (user.role === 'admin') {
        jobs = await env.DB.prepare(
            `SELECT j.*, u.name as customerName FROM jobs j JOIN users u ON j.customerId = u.id WHERE j.status IN ('pending_quote', 'pending_confirmation')`
        ).all();
    } else {
        jobs = await env.DB.prepare(
            `SELECT * FROM jobs WHERE customerId = ? AND status IN ('pending_quote', 'pending_confirmation')`
        ).bind(user.id).all();
    }

    return c.json(jobs.results);
}

export async function handleDeclineQuote(c: Context<AppEnv>) {
    const { quoteId } = c.req.param();
    const db = c.env.DB;

    try {
        const job = await db.prepare(`SELECT * FROM jobs WHERE stripe_quote_id = ?`).bind(quoteId).first<Job>();
        if (!job) {
            return errorResponse("Job with this quote not found.", 404);
        }

        await db.prepare(`UPDATE jobs SET status = 'quote_declined' WHERE id = ?`).bind(job.id).run();

        return successResponse({ message: "Quote declined." });
    } catch (e: any) {
        console.error(`Failed to decline quote ${quoteId}:`, e);
        return errorResponse(`Failed to decline quote: ${e.message}`, 500);
    }
}

export async function handleReviseQuote(c: Context<AppEnv>) {
    const { quoteId } = c.req.param();
    const { revisionReason } = await c.req.json();
    const db = c.env.DB;
    const user = c.get('user');

    if (!revisionReason) {
        return errorResponse("Revision reason is required.", 400);
    }

    try {
        const job = await db.prepare(`SELECT * FROM jobs WHERE stripe_quote_id = ?`).bind(quoteId).first<Job>();
        if (!job) {
            return errorResponse("Job with this quote not found.", 404);
        }

        await db.prepare(`UPDATE jobs SET status = 'quote_revised' WHERE id = ?`).bind(job.id).run();

        // Add the revision reason as a note
        await db.prepare(`INSERT INTO notes (job_id, user_id, content) VALUES (?, ?, ?)`).bind(
            job.id,
            user.id,
            `Quote revision requested: ${revisionReason}`
        ).run();

        return successResponse({ message: "Quote revision requested." });
    } catch (e: any) {
        console.error(`Failed to request revision for quote ${quoteId}:`, e);
        return errorResponse(`Failed to request revision for quote: ${e.message}`, 500);
    }
}