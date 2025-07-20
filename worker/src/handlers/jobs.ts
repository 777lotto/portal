// worker/src/handlers/jobs.ts
import { Context as HonoContext } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AppEnv as WorkerAppEnv } from '../index.js';
import { errorResponse as workerErrorResponse, successResponse as workerSuccessResponse } from '../utils.js';
import { generateCalendarFeed, createJob } from '../calendar.js';
import type { Job, Service } from '@portal/shared';
import { getStripe } from '../stripe.js';

const BlockDatePayload = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  reason: z.string().optional().nullable(),
});

export const handleGetServicesForJob = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const { jobId } = c.req.param();

    try {
        // First, verify the user owns the job
        const job = await c.env.DB.prepare(
            `SELECT id FROM jobs WHERE id = ? AND customerId = ?`
        ).bind(jobId, user.id.toString()).first<Job>();

        if (!job && user.role !== 'admin') {
            return workerErrorResponse("Job not found or access denied", 404);
        }

        // If ownership is confirmed, fetch the services
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM services WHERE job_id = ? ORDER BY id ASC`
        ).bind(jobId).all<Service>();

        return workerSuccessResponse(results || []);
    } catch (e: any) {
        console.error(`Failed to get services for job ${jobId}:`, e);
        return workerErrorResponse("Failed to retrieve services.", 500);
    }
}

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

// --- NEW: HANDLER TO ADD A SERVICE TO A JOB ---
export const handleAdminAddServiceToJob = async (c: HonoContext<WorkerAppEnv>) => {
    const { jobId } = c.req.param();
    const body = await c.req.json();
    // Basic validation
    if (!body.notes || !body.price_cents) {
        return workerErrorResponse("Service notes and price_cents are required.", 400);
    }

    try {
        const job = await c.env.DB.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first<Job>();
        if (!job) {
            return workerErrorResponse("Job not found.", 404);
        }

        const { results } = await c.env.DB.prepare(
            `INSERT INTO services (user_id, job_id, service_date, status, notes, price_cents)
             VALUES (?, ?, ?, ?, ?, ?) RETURNING *`
        ).bind(
            job.customerId,
            jobId,
            job.start, // Use job's start date as the service date
            'pending',
            body.notes,
            body.price_cents
        ).all<Service>();

        return workerSuccessResponse(results[0], 201);
    } catch (e: any) {
        console.error(`Failed to add service to job ${jobId}:`, e);
        return workerErrorResponse("Failed to add service.", 500);
    }
}

// --- NEW: HANDLER TO MARK JOB AS COMPLETE AND INVOICE ---
export const handleAdminCompleteJob = async (c: HonoContext<WorkerAppEnv>) => {
    const { jobId } = c.req.param();
    const db = c.env.DB;
    const stripe = getStripe(c.env);

    try {
        const job = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first<Job>();
        if (!job) return workerErrorResponse("Job not found", 404);

        const services = await db.prepare(`SELECT * FROM services WHERE job_id = ?`).bind(jobId).all<Service>();
        if (!services.results || services.results.length === 0) {
            return workerErrorResponse("Cannot complete a job with no services.", 400);
        }

        // Create a draft invoice
        const draftInvoice = await stripe.invoices.create({
            customer: job.customerId,
            collection_method: 'send_invoice',
            description: `Invoice for job: ${job.title}`,
            auto_advance: false,// Keep it as a draft until all items are added
        });
        if (!draftInvoice.id) {
    return workerErrorResponse("Failed to create a draft invoice.", 500);
}

        // Add each service as a line item
        for (const service of services.results) {
            await stripe.invoiceItems.create({
                customer: job.customerId,
                invoice: draftInvoice.id,
                description: service.notes || 'Service',
                amount: service.price_cents || 0,
                currency: 'usd',
            });
        }

        // Finalize the invoice
        const finalInvoice = await stripe.invoices.finalizeInvoice(draftInvoice.id);

if (!finalInvoice?.id) {
            throw new Error('Failed to finalize invoice: No ID returned from Stripe.');
        }
        // Send the invoice
        await stripe.invoices.sendInvoice(finalInvoice.id);

        // Update job status in DB
        await db.prepare(`UPDATE jobs SET status = 'completed', stripe_invoice_id = ? WHERE id = ?`)
            .bind(finalInvoice.id, jobId)
            .run();

        return workerSuccessResponse({ invoiceId: finalInvoice.id, invoiceUrl: finalInvoice.hosted_invoice_url });

    } catch (e: any) {
        console.error(`Failed to complete job ${jobId}:`, e);
        return workerErrorResponse(`Failed to complete job: ${e.message}`, 500);
    }
}
