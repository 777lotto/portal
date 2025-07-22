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
