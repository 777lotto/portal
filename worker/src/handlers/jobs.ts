// worker/src/handlers/jobs.ts
import { Context as HonoContext } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AppEnv as WorkerAppEnv } from '../index.js';
import { errorResponse, successResponse } from '../utils.js';
import { generateCalendarFeed, createJob } from '../calendar.js';
import type { Job, Service, User } from '@portal/shared'; // Corrected: Added User import
import { getStripe } from '../stripe.js';

const BlockDatePayload = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  reason: z.string().optional().nullable(),
});

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
        const newJob = await createJob(c.env, body, user.id.toString());
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
        const now = new Date().toISOString();

        if (user.role === 'admin') {
            dbResponse = await c.env.DB.prepare(
                `SELECT * FROM jobs WHERE status = 'upcoming' AND start >= ? ORDER BY start ASC`
            ).bind(now).all<Job>();
        } else {
            dbResponse = await c.env.DB.prepare(
                `SELECT * FROM jobs WHERE customerId = ? AND status = 'upcoming' AND start >= ? ORDER BY start ASC`
            ).bind(user.id.toString(), now).all<Job>();
        }

        const jobs = dbResponse?.results || [];
        return successResponse(jobs);
    } catch (e: any) {
        return errorResponse("Failed to retrieve jobs", 500);
    }
};

export const handleGetJobById = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const { id } = c.req.param();
    try {
        const job = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE id = ?`
        ).bind(id).first<Job>();

        if (!job) {
            return errorResponse("Job not found", 404);
        }

        if (user.role !== 'admin' && job.customerId !== user.id.toString()) {
            return errorResponse("Job not found", 404);
        }

        return successResponse(job);
    } catch (e: any) {
        return errorResponse("Failed to retrieve job", 500);
    }
};

export const handleAdminReassignJob = async (c: HonoContext<WorkerAppEnv>) => {
    const { jobId } = c.req.param();
    const { newCustomerId } = await c.req.json();

    if (!newCustomerId) {
        return errorResponse("New customer ID is required.", 400);
    }

    try {
        await c.env.DB.prepare(
            `UPDATE jobs SET customerId = ? WHERE id = ?`
        ).bind(newCustomerId, jobId).run();

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

// --- Admin Handlers for Blocked Dates ---

export async function handleGetBlockedDates(c: HonoContext<WorkerAppEnv>) {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT date, reason FROM blocked_dates ORDER BY date ASC`
    ).all<{ date: string, reason: string }>();
    return successResponse(results || []);
  } catch (e: any) {
    console.error("Error fetching blocked dates:", e);
    return errorResponse('Failed to fetch blocked dates.', 500);
  }
}

export async function handleAddBlockedDate(c: HonoContext<WorkerAppEnv>) {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = BlockDatePayload.safeParse(body);

  if (!parsed.success) {
    return errorResponse("Invalid data", 400, parsed.error.flatten());
  }

  const { date, reason } = parsed.data;

  try {
    await c.env.DB.prepare(
      `INSERT INTO blocked_dates (date, reason, user_id) VALUES (?, ?, ?)`
    ).bind(date, reason || null, user.id).run();
    return successResponse({ date, reason }, 201);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint failed')) {
      return errorResponse("This date is already blocked.", 409);
    }
    console.error("Error adding blocked date:", e);
    return errorResponse('Failed to block date.', 500);
  }
}

export async function handleRemoveBlockedDate(c: HonoContext<WorkerAppEnv>) {
  const { date } = c.req.param();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return errorResponse("Invalid date format in URL. Use YYYY-MM-DD.", 400);
  }

  try {
    const { success } = await c.env.DB.prepare(
      `DELETE FROM blocked_dates WHERE date = ?`
    ).bind(date).run();

    if (!success) {
      return errorResponse('Failed to unblock date.', 500);
    }
    return successResponse({ message: `Date ${date} has been unblocked.` });
  } catch (e: any) {
    console.error("Error removing blocked date:", e);
    return errorResponse('Failed to unblock date.', 500);
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

        await c.env.DB.prepare(
            `UPDATE jobs SET title = ?, description = ?, recurrence = ?, updatedAt = ? WHERE id = ?`
        ).bind(updatedTitle, updatedDescription, updatedRecurrence, new Date().toISOString(), jobId).run();

        return successResponse({ message: "Job updated successfully." });
    } catch (e: any) {
        return errorResponse(`Failed to update job: ${e.message}`, 500);
    }
};

export const handleAdminAddServiceToJob = async (c: HonoContext<WorkerAppEnv>) => {
    const { jobId } = c.req.param();
    const body = await c.req.json();
    if (!body.notes || body.price_cents === undefined) {
        return errorResponse("Service notes and price_cents are required.", 400);
    }

    try {
        const job = await c.env.DB.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first<Job>();
        if (!job) return errorResponse("Job not found.", 404);

        const { results } = await c.env.DB.prepare(
            `INSERT INTO services (user_id, job_id, service_date, status, notes, price_cents)
             VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
        ).bind(job.customerId, jobId, job.start, 'pending', body.notes, body.price_cents).all<Service>();

        return successResponse(results[0], 201);
    } catch (e: any) {
        return errorResponse(`Failed to add service: ${e.message}`, 500);
    }
};

export const handleAdminUpdateServiceInJob = async (c: HonoContext<WorkerAppEnv>) => {
    const { jobId, serviceId } = c.req.param();
    const body = await c.req.json();
    if (!body.notes || body.price_cents === undefined) {
        return errorResponse("Service notes and price_cents are required.", 400);
    }
    try {
        await c.env.DB.prepare(
            `UPDATE services SET notes = ?, price_cents = ? WHERE id = ? AND job_id = ?`
        ).bind(body.notes, body.price_cents, serviceId, jobId).run();
        return successResponse({ message: 'Service updated successfully' });
    } catch (e: any) {
        return errorResponse(`Failed to update service: ${e.message}`, 500);
    }
};

export const handleAdminDeleteServiceFromJob = async (c: HonoContext<WorkerAppEnv>) => {
    const { jobId, serviceId } = c.req.param();
    try {
        await c.env.DB.prepare(
            `DELETE FROM services WHERE id = ? AND job_id = ?`
        ).bind(serviceId, jobId).run();
        return successResponse({ message: 'Service deleted successfully' });
    } catch (e: any) {
        return errorResponse(`Failed to delete service: ${e.message}`, 500);
    }
};

export const handleAdminCompleteJob = async (c: HonoContext<WorkerAppEnv>) => {
    const { jobId } = c.req.param();
    const db = c.env.DB;
    const stripe = getStripe(c.env);

    try {
        const job = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first<Job>();
        if (!job) return errorResponse("Job not found", 404);

        const customer = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(job.customerId).first<User>();
        if (!customer || !customer.stripe_customer_id) {
            return errorResponse("Customer not found or not linked to Stripe.", 404);
        }

        const services = await db.prepare(`SELECT * FROM services WHERE job_id = ?`).bind(jobId).all<Service>();
        if (!services.results || services.results.length === 0) {
            return errorResponse("Cannot complete a job with no services.", 400);
        }

        const draftInvoice = await stripe.invoices.create({
            customer: customer.stripe_customer_id,
            collection_method: 'send_invoice',
            description: `Invoice for job: ${job.title}`,
            auto_advance: false,
        });
        if (!draftInvoice.id) {
            return errorResponse("Failed to create a draft invoice.", 500);
        }

        for (const service of services.results) {
            await stripe.invoiceItems.create({
                customer: customer.stripe_customer_id,
                invoice: draftInvoice.id,
                description: service.notes || 'Service',
                amount: service.price_cents || 0,
                currency: 'usd',
            });
        }

        const finalInvoice = await stripe.invoices.finalizeInvoice(draftInvoice.id);
        if (!finalInvoice?.id) {
            throw new Error('Failed to finalize invoice: No ID returned from Stripe.');
        }

        await stripe.invoices.sendInvoice(finalInvoice.id);

        await db.prepare(`UPDATE jobs SET status = 'payment_needed', stripe_invoice_id = ? WHERE id = ?`)
            .bind(finalInvoice.id, jobId)
            .run();

        return successResponse({ invoiceId: finalInvoice.id, invoiceUrl: finalInvoice.hosted_invoice_url });
    } catch (e: any) {
        console.error(`Failed to complete job ${jobId}:`, e);
        return errorResponse(`Failed to complete job: ${e.message}`, 500);
    }
};

export const handleGetServicesForJob = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const { jobId } = c.req.param();

    try {
        const job = await c.env.DB.prepare(
            `SELECT customerId FROM jobs WHERE id = ?`
        ).bind(jobId).first<{ customerId: string }>();

        if (!job) return errorResponse("Job not found", 404);
        if (user.role !== 'admin' && job.customerId !== user.id.toString()) {
            return errorResponse("Access denied", 403);
        }

        const { results } = await c.env.DB.prepare(
            `SELECT * FROM services WHERE job_id = ? ORDER BY id ASC`
        ).bind(jobId).all<Service>();

        return successResponse(results || []);
    } catch (e: any) {
        return errorResponse("Failed to retrieve services.", 500);
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

        const simplifiedInvoices = invoices.data.map(inv => ({
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
