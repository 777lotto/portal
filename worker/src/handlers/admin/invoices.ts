// worker/src/handlers/admin/invoices.ts
import { Context } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import { getStripe } from '../../stripe.js';
import type { User } from '@portal/shared';

// Handler to get a single invoice's details, including its line items
export async function handleAdminGetInvoice(c: Context<AppEnv>) {
    const { invoiceId } = c.req.param();
    const stripe = getStripe(c.env);
    try {
        const invoice = await stripe.invoices.retrieve(invoiceId, {
            expand: ['lines'],
        });
        return successResponse(invoice);
    } catch (e: any) {
        console.error(`Failed to retrieve invoice ${invoiceId}:`, e);
        return errorResponse(e.message, 500);
    }
}

// Handler to add a new line item to a draft invoice
export async function handleAdminAddInvoiceItem(c: Context<AppEnv>) {
    const { invoiceId } = c.req.param();
    const { description, amount } = await c.req.json();
    const stripe = getStripe(c.env);

    try {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        if (invoice.status !== 'draft') {
            return errorResponse('Cannot add items to a finalized invoice.', 400);
        }

        // FINAL FIX: Use top-level properties for creating a simple invoice item.
        // The Stripe SDK types are very specific here.
        const invoiceItem = await stripe.invoiceItems.create({
            customer: invoice.customer as string,
            invoice: invoiceId,
            description: description,
            amount: amount, // Using 'amount' (in cents) which is a valid property here
            currency: 'usd',
        });

        return successResponse(invoiceItem, 201);
    } catch (e: any) {
        console.error(`Failed to add item to invoice ${invoiceId}:`, e);
        return errorResponse(e.message, 500);
    }
}

// Handler to delete a line item from a draft invoice
export async function handleAdminDeleteInvoiceItem(c: Context<AppEnv>) {
    const { itemId } = c.req.param();
    const stripe = getStripe(c.env);
    try {
        const deletedItem = await stripe.invoiceItems.del(itemId);
        return successResponse({ deleted: deletedItem.deleted, id: deletedItem.id });
    } catch (e: any) {
        console.error(`Failed to delete invoice item ${itemId}:`, e);
        return errorResponse(e.message, 500);
    }
}

// Handler to finalize a draft invoice, which makes it ready to be paid
export async function handleAdminFinalizeInvoice(c: Context<AppEnv>) {
    const { invoiceId } = c.req.param();
    const stripe = getStripe(c.env);
    try {
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoiceId);

        if (!finalizedInvoice || !finalizedInvoice.id) {
            throw new Error('Failed to finalize invoice: No ID returned from Stripe.');
        }

        const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id);
        return successResponse(sentInvoice);
    } catch (e: any) {
        console.error(`Failed to finalize invoice ${invoiceId}:`, e);
        return errorResponse(e.message, 500);
    }
}

// NEW: Handler to import paid Stripe invoices as historical jobs
export async function handleAdminImportInvoices(c: Context<AppEnv>) {
    const stripe = getStripe(c.env);
    const db = c.env.DB;
    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    try {
        const invoices = await stripe.invoices.list({
            status: 'paid',
            limit: 100,
            expand: ['data.customer', 'data.lines.data'],
        });

        for (const invoice of invoices.data) {
            if (!invoice.customer || typeof invoice.customer !== 'object' || invoice.customer.deleted) {
                skippedCount++;
                continue;
            }

            const existingJob = await db.prepare(`SELECT id FROM jobs WHERE stripe_invoice_id = ?`).bind(invoice.id).first();
            if (existingJob) {
                skippedCount++;
                continue;
            }

            const user = await db.prepare(`SELECT id FROM users WHERE stripe_customer_id = ?`).bind(invoice.customer.id).first<User>();
            if (!user) {
                errors.push(`User not found for Stripe customer ${invoice.customer.id}`);
                skippedCount++;
                continue;
            }

            const jobStartDate = new Date((invoice.status_transitions.paid_at || invoice.created) * 1000);
            const jobEndDate = new Date(jobStartDate.getTime() + 60 * 60 * 1000);
            const jobTitle = invoice.lines.data[0]?.description || invoice.description || `Imported Job ${invoice.id}`;
            const newJobId = uuidv4();

            const jobInsertStmt = db.prepare(
                `INSERT INTO jobs (id, customerId, title, description, start, end, status, recurrence, stripe_invoice_id, invoice_created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(newJobId, user.id.toString(), jobTitle, invoice.description || `Imported from Stripe Invoice #${invoice.number}`, jobStartDate.toISOString(), jobEndDate.toISOString(), 'paid', 'none', invoice.id, new Date(invoice.created * 1000).toISOString());

            const serviceInserts: D1PreparedStatement[] = invoice.lines.data.map(item =>
                db.prepare(`INSERT INTO services (user_id, job_id, service_date, status, notes, price_cents) VALUES (?, ?, ?, ?, ?, ?)`
                ).bind(user.id, newJobId, jobStartDate.toISOString(), 'completed', item.description || 'Imported Service', item.amount)
            );

            await db.batch([jobInsertStmt, ...serviceInserts]);
            importedCount++;
        }

        return successResponse({ message: `Import complete.`, imported: importedCount, skipped: skippedCount, errors });

    } catch (e: any) {
        console.error("Failed to import Stripe invoices:", e);
        return errorResponse(`Failed to import invoices: ${e.message}`, 500);
    }
}
