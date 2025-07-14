// worker/src/handlers/admin/invoices.ts
import { Context } from 'hono';
import type { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import { getStripe } from '../../stripe.js';

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
