// worker/src/handlers/jobs.ts
import { Context as HonoContext } from 'hono';
import { AppEnv as WorkerAppEnv } from '../index.js';
import { errorResponse, successResponse } from '../utils.js';
import type { Job, LineItem, User } from '@portal/shared';
import { getStripe } from '../stripe/index.js';
import Stripe from 'stripe';



export const handleGetJobs = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    try {
        // This endpoint now returns all jobs for the current user,
        // allowing the frontend to categorize them.
        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE user_id = ? ORDER BY createdAt DESC`
        ).bind(user.id.toString()).all<Job>(); // Changed: user.id -> user.id.toString()

        const jobs = dbResponse?.results || [];
        return successResponse(jobs);
    } catch (e: any) {
        console.error("Failed to retrieve jobs for user:", e);
        return errorResponse("Failed to retrieve jobs", 500);
    }
};

export const handleGetJobById = async (c: HonoContext<WorkerAppEnv>) => {
    const db = c.env.DB;
    const user = c.get('user');
    const { id } = c.req.param();

    try {
        const job = await db.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first<Job>();
        if (!job) {
            return errorResponse("Job not found", 404);
        }

        if (user.role !== 'admin' && parseInt(job.user_id, 10) !== user.id) {
            return errorResponse("Access denied", 403);
        }

        const { results: lineItems } = await db.prepare('SELECT * FROM line_items WHERE job_id = ?').bind(id).all<LineItem>();

        return c.json({ ...job, lineItems: lineItems || [] });
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
        const updatedStatus = body.status ?? job.status;

        await c.env.DB.prepare(
            `UPDATE jobs SET title = ?, description = ?, recurrence = ?, due = ?, status = ?, updatedAt = ? WHERE id = ?`
        ).bind(updatedTitle, updatedDescription, updatedRecurrence, updatedDue, updatedStatus, new Date().toISOString(), jobId).run();

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
    const { jobId } = c.req.param();
    const db = c.env.DB;
    const stripe = getStripe(c.env);

    try {
        const job = await db.prepare(`SELECT * FROM jobs WHERE id = ?`).bind(jobId).first<Job>();
        if (!job) return errorResponse("Job not found", 404);

        const customer = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(job.user_id).first<User>();
        if (!customer || !customer.stripe_customer_id) {
            return errorResponse("Customer not found or not linked to Stripe.", 404);
        }

        const { results: lineItems } = await db.prepare(`SELECT * FROM line_items WHERE job_id = ?`).bind(jobId).all<LineItem>();
        if (!lineItems || lineItems.length === 0) {
            return errorResponse("Cannot complete a job with no line items.", 400);
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

        for (const item of lineItems) {
            await stripe.invoiceItems.create({
                customer: customer.stripe_customer_id,
                invoice: draftInvoice.id,
                description: item.description,
                quantity: item.quantity,
                amount: item.unit_total_amount_cents,
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

interface BookingRequest {
  property_id: string;
  selectedServices: {
    id: string;
    name: string;
    estimated_hours: number;
  }[];
  otherService: string;
}

export const handleCreateJob = async (c: HonoContext<WorkerAppEnv>) => {
    const { property_id, selectedServices, otherService } = await c.req.json<BookingRequest>();
    const user = c.get('user');

    if (!property_id) {
        return errorResponse("property_id is required", 400);
    }

    try {
        const now = new Date().toISOString();
        const newJobId = crypto.randomUUID();

        await c.env.DB.prepare(`
            INSERT INTO jobs (id, property_id, status, user_id, created_at, updated_at)
            VALUES (?, ?, 'needs_quote', ?, ?, ?)
        `).bind(newJobId, property_id, user.id, now, now).run();

        const lineItems = selectedServices.map(service => ({
            id: crypto.randomUUID(),
            job_id: newJobId,
            description: service.name,
            quantity: service.estimated_hours, // Using quantity for estimated hours
            unit_total_amount_cents: null, // Price to be set by admin
            created_at: now,
            updated_at: now,
        }));

        if (otherService) {
            lineItems.push({
                id: crypto.randomUUID(),
                job_id: newJobId,
                description: otherService,
                quantity: 1, // To be set by admin
                unit_total_amount_cents: null, // Price to be set by admin
                created_at: now,
                updated_at: now,
            });
        }

        const lineItemsStmt = c.env.DB.prepare(`
            INSERT INTO line_items (id, job_id, description, quantity, unit_total_amount_cents, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const lineItemPromises = lineItems.map(item =>
            lineItemsStmt.bind(item.id, item.job_id, item.description, item.quantity, item.unit_total_amount_cents, item.created_at, item.updated_at).run()
        );
        await Promise.all(lineItemPromises);


        return successResponse({ id: newJobId });
    } catch (e: any) {
        console.error("Failed to create job:", e);
        return errorResponse("Failed to create job", 500);
    }
};
