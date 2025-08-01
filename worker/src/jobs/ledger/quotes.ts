// worker/src/handlers/quotes.ts

import { Context } from 'hono';
import { AppEnv } from '../index.js';
import { errorResponse, successResponse } from '../utils.js';
import type { Job } from '@portal/shared';

export async function getPendingQuotes(c: Context<AppEnv>) {
    const user = c.get('user');
    const env = c.env;

    let jobs;
    if (user.role === 'admin') {
        // FIX: Changed j.user_id to j.user_id to match the database schema.
        jobs = await env.DB.prepare(
            `SELECT j.*, u.name as customerName FROM jobs j JOIN users u ON j.user_id = u.id WHERE j.status = 'pending'`
        ).all();
    } else {
        // FIX: Changed user_id to user_id to match the database schema.
        jobs = await env.DB.prepare(
            `SELECT * FROM jobs WHERE user_id = ? AND status = 'pending'`
        ).bind(user.id).all();
    }

    return c.json(jobs.results);
}

export async function getQuoteById(c: Context<AppEnv>) {
    const { quoteId } = c.req.param();
    const user = c.get('user');
    const env = c.env;

    let job;
    if (user.role === 'admin') {
        // Admins can view any job/quote regardless of status
        // FIX: Changed j.user_id to j.user_id
        job = await env.DB.prepare(
            `SELECT j.*, u.name as customerName FROM jobs j JOIN users u ON j.user_id = u.id WHERE j.id = ?`
        ).bind(quoteId).first();
    } else {
        // Customers can only view jobs that are pending quotes
        // FIX: Changed user_id to user_id
        job = await env.DB.prepare(
            `SELECT * FROM jobs WHERE id = ? AND user_id = ? AND status = 'pending'`
        ).bind(quoteId, user.id).first();
    }

    if (!job) {
        return errorResponse("Quote not found.", 404);
    }

    const services = await env.DB.prepare(
        `SELECT * FROM services WHERE job_id = ?`
    ).bind(quoteId).all();

    return successResponse({ ...job, services: services.results });
}

export async function handleDeclineQuote(c: Context<AppEnv>) {
    const { quoteId } = c.req.param();
    const db = c.env.DB;
    const user = c.get('user');

    try {
        const job = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(quoteId).first<Job>();
        if (!job) {
            return errorResponse("Job with this quote not found.", 404);
        }

        // FIX: Changed user_id to user_id
        if (job.user_id.toString() !== user.id.toString() && user.role !== 'admin') {
            return errorResponse("You are not authorized to decline this quote.", 403);
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
        const job = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(quoteId).first<Job>();
        if (!job) {
            return errorResponse("Job with this quote not found.", 404);
        }

        // FIX: Changed user_id to user_id
        if (job.user_id.toString() !== user.id.toString() && user.role !== 'admin') {
            return errorResponse("You are not authorized to revise this quote.", 403);
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
