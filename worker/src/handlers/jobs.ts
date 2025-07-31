// worker/src/handlers/jobs.ts
import { Context as HonoContext } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AppEnv as WorkerAppEnv } from '../index.js';
import { errorResponse, successResponse } from '../utils.js';
import { generateCalendarFeed, createJob } from '../calendar.js';
import type { Job, LineItem, User, CalendarEvent } from '@portal/shared'; 
import { CalendarEventSchema } from '@portal/shared';

import { getStripe } from '../stripe.js';
import Stripe from 'stripe';

// --- Calendar URL Handlers ---

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
        return successResponse({ url });

    } catch (e: any) {
        console.error(`Failed to get or create calendar token for user ${user.id}:`, e);
        return errorResponse("Could not retrieve calendar URL.", 500);
    }
};

export const handleRegenerateSecretCalendarUrl = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');

    try {
        await c.env.DB.prepare(
            `DELETE FROM calendar_tokens WHERE user_id = ?`
        ).bind(user.id).run();

        const newToken = uuidv4();
        await c.env.DB.prepare(
            `INSERT INTO calendar_tokens (token, user_id) VALUES (?, ?)`
        ).bind(newToken, user.id).run();

        const url = `${portalBaseUrl}/api/public/calendar/feed/${newToken}.ics`;
        return successResponse({ url });

    } catch (e: any) {
         console.error(`Failed to regenerate calendar token for user ${user.id}:`, e);
        return errorResponse("Could not regenerate calendar URL.", 500);
    }
};


export const handleCreateJob = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const body = await c.req.json();

    try {
        const newJob = await createJob(c.env, body, user.id);
        return successResponse(newJob, 201);
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return errorResponse("Invalid job data provided.", 400, e.flatten());
        }
        console.error("Failed to create job:", e);
        return errorResponse("Failed to create job.", 500);
    }
};

export const handleGetJobs = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    try {
        let dbResponse;

        if (user.role === 'admin') {
            dbResponse = await c.env.DB.prepare(
                `SELECT * FROM jobs WHERE status = 'upcoming' ORDER BY createdAt ASC`
            ).all<Job>();
        } else {
            dbResponse = await c.env.DB.prepare(
                `SELECT * FROM jobs WHERE user_id = ? AND status = 'upcoming' ORDER BY createdAt ASC`
            ).bind(user.id).all<Job>();
        }

        const jobs = dbResponse?.results || [];
        return successResponse(jobs);
    } catch (e: any) {
        return errorResponse("Failed to retrieve jobs", 500);
    }
};

export const handleGetJobById = async (c: HonoContext<WorkerAppEnv>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const { id } = c.req.param();

    try {
        const job: Job = await db.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first();
        if (!job) {
            return errorResponse("Job not found", 404);
        }

        // Corrected: Direct comparison between two numbers is correct.
        if (user.role !== 'admin' && job.user_id !== user.id) {
            return errorResponse("Job not found", 404);
        }

        const lineItems: LineItem[] = await db.prepare('SELECT * FROM line_items WHERE job_id = ?').bind(id).all();

        return c.json({ ...job, lineItems });
    } catch (e: any) {
        console.error('Failed to get job:', e);
        return errorResponse('An internal error occurred while fetching the job: ' + e.message, 500);
    }
};

export const handleAdminReassignJob = async (c: HonoContext<WorkerAppEnv>) => {
    const { jobId } = c.req.param();
    const { newuser_id } = await c.req.json();

    if (!newuser_id) {
        return errorResponse("New user ID is required.", 400);
    }

    try {
        await c.env.DB.prepare(
            `UPDATE jobs SET user_id = ? WHERE id = ?`
        ).bind(newuser_id, jobId).run();

        const updatedJob = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE id = ?`
        ).bind(jobId).first<Job>();

        return successResponse(updatedJob);
    } catch (e: any) {
        console.error(`Failed to reassign job ${jobId}:`, e);
        return errorResponse("Failed to reassign job.", 500);
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
        return errorResponse("Could not generate calendar feed.", 500);
    }
};

// --- Admin Handlers for Calendar Events ---

export async function handleGetCalendarEvents(c: HonoContext<WorkerAppEnv>) {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM calendar_events ORDER BY start ASC`
    ).all<CalendarEvent>();
    return successResponse(results || []);
  } catch (e: any) {
    console.error("Error fetching calendar events:", e);
    return errorResponse('Failed to fetch calendar events.', 500);
  }
}

export async function handleAddCalendarEvent(c: HonoContext<WorkerAppEnv>) {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = CalendarEventSchema.omit({ id: true, user_id: true }).safeParse(body);

  if (!parsed.success) {
    return errorResponse("Invalid data", 400, parsed.error.flatten());
  }

  const { title, start, end, type, job_id } = parsed.data;

  try {
    await c.env.DB.prepare(
      `INSERT INTO calendar_events (title, start, end, type, job_id, user_id) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(title, start, end, type, job_id || null, user.id).run();
    return successResponse({ ...parsed.data, user_id: user.id }, 201);
  } catch (e: any) {
    console.error("Error adding calendar event:", e);
    return errorResponse('Failed to add calendar event.', 500);
  }
}

export async function handleRemoveCalendarEvent(c: HonoContext<WorkerAppEnv>) {
  const { eventId } = c.req.param();

  try {
    const { success } = await c.env.DB.prepare(
      `DELETE FROM calendar_events WHERE id = ?`
    ).bind(eventId).run();

    if (!success) {
      return errorResponse('Failed to remove calendar event.', 500);
    }
    return successResponse({ message: `Calendar event ${eventId} has been removed.` });
  } catch (e: any) {
    console.error("Error removing calendar event:", e);
    return errorResponse('Failed to remove calendar event.', 500);
  }
}

// --- NEW/CORRECTED ADMIN JOB HANDLERS ---

export const handleAdminUpdateJobDetails = async (c: HonoContext<WorkerAppEnv>) => {
    const { jobId } = c.req.param();
    const body = await c.req.json();
    try {
        const job = await c.env.DB.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first<Job>();
        if (!job) return errorResponse("Job not found", 404);

        const updatedTitle = body.title ?? job.title;
        const updatedDescription = body.description ?? job.description;
        const updatedRecurrence = body.recurrence ?? job.recurrence;
        const updatedDue = body.due ?? job.due;

        await c.env.DB.prepare(
            `UPDATE jobs SET title = ?, description = ?, recurrence = ?, due = ?, updatedAt = ? WHERE id = ?`
        ).bind(updatedTitle, updatedDescription, updatedRecurrence, updatedDue, new Date().toISOString(), jobId).run();

        return successResponse({ message: "Job updated successfully." });
    } catch (e: any) {
        return errorResponse(`Failed to update job: ${e.message}`, 500);
    }
};

export const handleAdminAddLineItemToJob = async (c: HonoContext<WorkerAppEnv>) => {
    const { jobId } = c.req.param();
    const body = await c.req.json();
    if (!body.description || body.quantity === undefined || body.unit_total_amount_cents === undefined) {
        return errorResponse("Line item description, quantity, and unit_total_amount_cents are required.", 400);
    }

    try {
        const job = await c.env.DB.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first<Job>();
        if (!job) return errorResponse("Job not found.", 404);

        const { results } = await c.env.DB.prepare(
            `INSERT INTO line_items (job_id, description, quantity, unit_total_amount_cents)
             VALUES (?, ?, ?, ?) RETURNING *`
        ).bind(jobId, body.description, body.quantity, body.unit_total_amount_cents).all<LineItem>();

        return successResponse(results[0], 201);
    } catch (e: any) {
        return errorResponse(`Failed to add line item: ${e.message}`, 500);
    }
};

export const handleAdminUpdateLineItemInJob = async (c: HonoContext<WorkerAppEnv>) => {
    const { jobId, lineItemId } = c.req.param();
    const body = await c.req.json();
    if (!body.description || body.quantity === undefined || body.unit_total_amount_cents === undefined) {
        return errorResponse("Line item description, quantity, and unit_total_amount_cents are required.", 400);
    }
    try {
        await c.env.DB.prepare(
            `UPDATE line_items SET description = ?, quantity = ?, unit_total_amount_cents = ? WHERE id = ? AND job_id = ?`
        ).bind(body.description, body.quantity, body.unit_total_amount_cents, lineItemId, jobId).run();
        return successResponse({ message: 'Line item updated successfully' });
    } catch (e: any) {
        return errorResponse(`Failed to update line item: ${e.message}`, 500);
    }
};

export const handleAdminDeleteLineItemFromJob = async (c: HonoContext<WorkerAppEnv>) => {
    const { jobId, lineItemId } = c.req.param();
    try {
        await c.env.DB.prepare(
            `DELETE FROM line_items WHERE id = ? AND job_id = ?`
        ).bind(lineItemId, jobId).run();
        return successResponse({ message: 'Line item deleted successfully' });
    } catch (e: any) {
        return errorResponse(`Failed to delete line item: ${e.message}`, 500);
    }
};

export const handleAdminCompleteJob = async (c: HonoContext<WorkerAppEnv>) => {
    const db = c.env.DB;
    const stripe = c.env.STRIPE;
    const { id } = c.req.param();

    try {
        const job: Job = await db.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first();
        if (!job) {
            return errorResponse("Job not found", 404);
        }

        const lineItems: LineItem[] = await db.prepare('SELECT * FROM line_items WHERE job_id = ?').bind(id).all();

        const customer: { stripe_customer_id: string } = await db.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').bind(job.user_id).first();

        const draftInvoice = await stripe.invoices.create({
            customer: customer.stripe_customer_id,
            collection_method: 'send_invoice',
            days_until_due: 30,
        });

        for (const item of lineItems) {
            await stripe.invoiceItems.create({
                customer: customer.stripe_customer_id,
                invoice: draftInvoice.id,
                // Corrected: 'description' is the correct property name
                description: item.description,
                // Corrected: 'quantity' is the correct property name
                quantity: item.quantity,
                // Corrected: 'unit_total_amount_cents' is the correct property name
                amount: item.unit_total_amount_cents,
                currency: 'usd',
            });
        }

        await stripe.invoices.sendInvoice(draftInvoice.id);

        await db.prepare('UPDATE jobs SET status = ? WHERE id = ?').bind('invoiced', id).run();

        return c.json({ message: 'Job completed and invoice sent' });
    } catch (e: any) {
        console.error('Failed to complete job:', e);
        return errorResponse('An internal error occurred while completing the job: ' + e.message, 500);
    }
};

export const handleGetLineItemsForJob = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const { jobId } = c.req.param();

    try {
        const job = await c.env.DB.prepare(
            `SELECT user_id FROM jobs WHERE id = ?`
        ).bind(jobId).first<{ user_id: number }>();

        if (!job) return errorResponse("Job not found", 404);
        if (user.role !== 'admin' && job.user_id !== user.id) {
            return errorResponse("Access denied", 403);
        }

        const { results } = await c.env.DB.prepare(
            `SELECT * FROM line_items WHERE job_id = ? ORDER BY id ASC`
        ).bind(jobId).all<LineItem>();

        return successResponse(results || []);
    } catch (e: any) {
        return errorResponse("Failed to retrieve line items.", 500);
    }
}

export const handleGetOpenInvoicesForUser = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const stripe = getStripe(c.env);

    if (!user.stripe_customer_id) {
        return successResponse([]);
    }

    try {
        const invoices = await stripe.invoices.list({
            customer: user.stripe_customer_id,
            status: 'open',
        });

        const simplifiedInvoices = invoices.data.map((inv: Stripe.Invoice) => ({
            id: inv.id,
            customer: inv.customer,
            hosted_invoice_url: inv.hosted_invoice_url,
            number: inv.number,
            status: inv.status,
            total: inv.total,
            due_date: inv.due_date,
        }));

        return successResponse(simplifiedInvoices);
    } catch (e: any) {
        return errorResponse("Failed to retrieve open invoices.", 500);
    }
};
