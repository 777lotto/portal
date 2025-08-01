// 777lotto/portal/portal-fold/worker/src/handlers/invoices.ts
import { Context } from 'hono';
import { AppEnv } from '../index.js';
import { errorResponse, successResponse } from '../utils.js';
import { getStripe } from '../stripe.js';

export const handleGetInvoiceForUser = async (c: Context<AppEnv>) => {
    const user = c.get('user');
    const { invoiceId } = c.req.param();
    const stripe = getStripe(c.env);

    try {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        if (invoice.customer !== user.stripe_customer_id) {
            return errorResponse("Invoice not found.", 404);
        }
        return successResponse(invoice);
    } catch (e: any) {
        return errorResponse(e.message, 500);
    }
};

export const handleCreatePaymentIntent = async (c: Context<AppEnv>) => {
    const user = c.get('user');
    const { invoiceId } = c.req.param();
    const stripe = getStripe(c.env);

    try {
        const invoice = await stripe.invoices.retrieve(invoiceId);
        if (invoice.customer !== user.stripe_customer_id) {
            return errorResponse("Invoice not found.", 404);
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: invoice.amount_remaining,
            currency: invoice.currency,
            customer: user.stripe_customer_id ?? undefined,
            metadata: { invoice_id: invoice.id as string },
        });

        return successResponse({ clientSecret: paymentIntent.client_secret });
    } catch (e: any) {
        return errorResponse(e.message, 500);
    }
};

export const handleDownloadInvoicePdf = async (c: Context<AppEnv>) => {
    const user = c.get('user');
    const { invoiceId } = c.req.param();
    const stripe = getStripe(c.env);

    try {
        // 1. Verify the invoice belongs to the requesting user
        const invoice = await stripe.invoices.retrieve(invoiceId);
        if (invoice.customer !== user.stripe_customer_id) {
            return errorResponse("Invoice not found.", 404);
        }

        // --- FIX START ---
        // The invoice object contains a URL to the PDF.
        if (!invoice.invoice_pdf) {
            return errorResponse("A PDF is not available for this invoice.", 404);
        }

        // 2. Fetch the PDF from the URL provided by Stripe
        const pdfResponse = await fetch(invoice.invoice_pdf);

        if (!pdfResponse.ok) {
            console.error('Stripe PDF download error:', await pdfResponse.text());
            throw new Error('Failed to download invoice PDF from Stripe URL.');
        }
        // --- FIX END ---

        // 3. Stream the PDF back to the client with appropriate headers to trigger a download
        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        headers.set('Content-Disposition', `attachment; filename="invoice-${invoice.number || invoice.id}.pdf"`);

        const contentLength = pdfResponse.headers.get('content-length');
        if (contentLength) {
            headers.set('content-length', contentLength);
        }

        return new Response(pdfResponse.body, {
            status: 200,
            headers: headers
        });

    } catch (e: any) {
        console.error(`Failed to download PDF for invoice ${invoiceId}:`, e);
        return errorResponse(e.message, 500);
    }
};



