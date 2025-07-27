// worker/src/handlers/admin/invoices.ts
import { Context } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import Stripe from 'stripe';
import type { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import { getStripe } from '../../stripe.js';
import type { User, DashboardInvoice } from '@portal/shared';

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

        const invoiceItem = await stripe.invoiceItems.create({
            customer: invoice.customer as string,
            invoice: invoiceId,
            description: description,
            amount: amount,
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

// Handler to import paid Stripe invoices as historical jobs
export async function handleAdminImportInvoices(c: Context<AppEnv>) {
    // userId is now optional, read from the path parameter if it exists
    const { userId } = c.req.param();
    const stripe = getStripe(c.env);
    const db = c.env.DB;

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    let hasMore = true;
    let startingAfter: string | undefined = undefined;

    try {
        // Prepare the initial parameters for the Stripe invoices.list call
        const listParams: Stripe.InvoiceListParams = {
            status: 'paid',
            limit: 100,
            expand: ['data.customer', 'data.lines.data'],
        };

        // If a userId is provided, fetch the user and add their Stripe customer ID to the params
        if (userId) {
            const user = await db.prepare(`SELECT id, stripe_customer_id FROM users WHERE id = ?`).bind(userId).first<User>();
            if (!user || !user.stripe_customer_id) {
                return errorResponse("User not found or does not have a Stripe customer ID.", 404);
            }
            listParams.customer = user.stripe_customer_id;
        }

        while (hasMore) {
            const invoices: Stripe.ApiList<Stripe.Invoice> = await stripe.invoices.list({
                ...listParams,
                starting_after: startingAfter,
            });

            if (invoices.data.length === 0) {
                hasMore = false;
                break;
            }

            for (const invoice of invoices.data) {
                if (!invoice.lines.data || invoice.lines.data.length === 0) {
                    skippedCount++;
                    continue;
                }

                if (!invoice.customer || typeof invoice.customer !== 'object' || invoice.customer.deleted) {
                    skippedCount++;
                    continue;
                }

                // This logic remains the same, finding or creating a user based on the Stripe customer ID
                let user: User | { id: number } | null = await db.prepare(`SELECT id FROM users WHERE stripe_customer_id = ?`).bind(invoice.customer.id).first<User>();
                if (!user) {
                    const customer = invoice.customer as Stripe.Customer;
                    const { name, email, phone } = customer;
                    const { results } = await db.prepare(
                        `INSERT INTO users (name, email, phone, stripe_customer_id, role) VALUES (?, ?, ?, ?, 'guest') RETURNING id`
                    ).bind(name || 'Stripe Customer', email, phone, invoice.customer.id).all<{ id: number }>();

                    if (!results || results.length === 0) {
                        errors.push(`Failed to create user for Stripe customer ${invoice.customer.id}`);
                        skippedCount++;
                        continue;
                    }
                    user = { id: results[0].id };
                }

                const existingJob = await db.prepare(`SELECT id FROM jobs WHERE stripe_invoice_id = ?`).bind(invoice.id).first();
                if (existingJob) {
                    skippedCount++;
                    continue;
                }

                const jobStartDate = new Date((invoice.status_transitions.paid_at || invoice.created) * 1000);
                const jobEndDate = new Date(jobStartDate.getTime() + 60 * 60 * 1000);
                const jobTitle = invoice.lines.data[0]?.description || invoice.description || `Imported Job ${invoice.id}`;
                const newJobId = uuidv4();

                const jobInsertStmt = db.prepare(
                    `INSERT INTO jobs (id, customerId, title, description, start, end, status, recurrence, stripe_invoice_id, invoice_created_at, total_amount_cents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    newJobId,
                    user.id.toString(),
                    jobTitle,
                    invoice.description || `Imported from Stripe Invoice #${invoice.number}`,
                    jobStartDate.toISOString(),
                    jobEndDate.toISOString(),
                    'paid',
                    'none',
                    invoice.id,
                    new Date(invoice.created * 1000).toISOString(),
                    invoice.total
                );

                const serviceInserts: D1PreparedStatement[] = invoice.lines.data.map((item) =>
                    db.prepare(`INSERT INTO services (job_id, service_date, status, notes, price_cents) VALUES (?, ?, ?, ?, ?)`
                    ).bind(newJobId, jobStartDate.toISOString(), 'completed', item.description || 'Imported Service', item.amount)
                );

                await db.batch([jobInsertStmt, ...serviceInserts]);
                importedCount++;
            }

            startingAfter = invoices.data[invoices.data.length - 1].id;
            hasMore = invoices.has_more;
        }

        return successResponse({ message: `Import complete.`, imported: importedCount, skipped: skippedCount, errors });

    } catch (e: any) {
        const errorMessage = userId ? `Failed to import Stripe invoices for user ${userId}:` : "Failed to import Stripe invoices:";
        console.error(errorMessage, e);
        return errorResponse(`Failed to import invoices: ${e.message}`, 500);
    }
}

export const handleAdminGetAllOpenInvoices = async (c: Context<AppEnv>) => {
    const stripe = getStripe(c.env);
    try {
        const invoices = await stripe.invoices.list({
            status: 'open',
            limit: 100, // Adjust as needed
        });

        const customerIds = invoices.data.map(inv => inv.customer).filter(c => typeof c === 'string');
        const uniqueCustomerIds = [...new Set(customerIds)];

        if (uniqueCustomerIds.length === 0) {
            return successResponse([]);
        }

        const placeholders = uniqueCustomerIds.map(() => '?').join(',');
        const users = await c.env.DB.prepare(
            `SELECT id, name, stripe_customer_id FROM users WHERE stripe_customer_id IN (${placeholders})`
        ).bind(...uniqueCustomerIds).all<User>();

        const userMap = new Map(users.results.map(u => [u.stripe_customer_id, u]));

        const enrichedInvoices: DashboardInvoice[] = invoices.data
            .filter((inv): inv is Stripe.Invoice & { id: string } => !!inv.id)
            .map(inv => {
                const user = userMap.get(inv.customer as string);
                return {
                    id: inv.id,
                    object: 'invoice',
                    customer: inv.customer as string,
                    status: inv.status,
                    total: inv.total,
                    hosted_invoice_url: inv.hosted_invoice_url ?? null,
                    number: inv.number,
                    due_date: inv.due_date,
                    userId: user?.id,
                    customerName: user?.name,
                };
            });

        return successResponse(enrichedInvoices);
    } catch (e: any) {
        console.error("Failed to get all open invoices:", e);
        return errorResponse("Failed to retrieve open invoices.", 500);
    }
};

export const handleAdminMarkInvoiceAsPaid = async (c: Context<AppEnv>) => {
    const { invoiceId } = c.req.param();
    const stripe = getStripe(c.env);

    try {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        if (!invoice) {
            return errorResponse("Invoice not found.", 404);
        }

        if (invoice.status === 'paid') {
            return errorResponse("Invoice is already paid.", 400);
        }

        const updatedInvoice = await stripe.invoices.pay(invoiceId, {
            paid_out_of_band: true,
        });

        return successResponse(updatedInvoice);
    } catch (e: any) {
        console.error(`Failed to mark invoice ${invoiceId} as paid:`, e);
        return errorResponse(e.message, 500);
    }
};
