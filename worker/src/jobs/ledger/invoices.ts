import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../../db';
import { users } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { getStripe } from '../../../stripe';
import type { User } from '@portal/shared';

const factory = createFactory();

// Middleware to get the authenticated user's full profile from the DB.
const userMiddleware = factory.createMiddleware(async (c, next) => {
	const auth = c.get('clerkUser');
	if (!auth?.id) {
		throw new HTTPException(401, { message: 'Unauthorized' });
	}
	const database = db(c.env.DB);
	const user = await database.select().from(users).where(eq(users.clerk_id, auth.id)).get();
	if (!user) {
		throw new HTTPException(401, { message: 'User not found.' });
	}
	c.set('user', user);
	await next();
});

/* ========================================================================
                      CUSTOMER-FACING INVOICE HANDLERS
   ======================================================================== */

/**
 * Retrieves a single Stripe invoice, ensuring it belongs to the authenticated user.
 */
export const getInvoice = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const { invoiceId } = c.req.param();
	const stripe = getStripe(c.env);

	const invoice = await stripe.invoices.retrieve(invoiceId);
	if (invoice.customer !== user.stripe_customer_id) {
		throw new HTTPException(404, { message: 'Invoice not found.' });
	}

	return c.json({ invoice });
});

/**
 * Creates a Stripe Payment Intent for a given invoice to facilitate payment.
 */
export const createPaymentIntent = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const { invoiceId } = c.req.param();
	const stripe = getStripe(c.env);

	const invoice = await stripe.invoices.retrieve(invoiceId);
	if (invoice.customer !== user.stripe_customer_id) {
		throw new HTTPException(404, { message: 'Invoice not found.' });
	}
	if (invoice.status !== 'open') {
		throw new HTTPException(400, { message: 'This invoice is not open for payment.' });
	}

	const paymentIntent = await stripe.paymentIntents.create({
		amount: invoice.amount_remaining,
		currency: invoice.currency,
		customer: user.stripe_customer_id ?? undefined,
		metadata: { invoice_id: invoice.id },
	});

	return c.json({ clientSecret: paymentIntent.client_secret });
});

/**
 * Securely streams the PDF of an invoice from Stripe to the client.
 */
export const downloadInvoicePdf = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const { invoiceId } = c.req.param();
	const stripe = getStripe(c.env);

	const invoice = await stripe.invoices.retrieve(invoiceId);
	if (invoice.customer !== user.stripe_customer_id) {
		throw new HTTPException(404, { message: 'Invoice not found.' });
	}
	if (!invoice.invoice_pdf) {
		throw new HTTPException(404, { message: 'A PDF is not available for this invoice.' });
	}

	// Fetch the PDF from the URL provided by Stripe
	const pdfResponse = await fetch(invoice.invoice_pdf);
	if (!pdfResponse.ok) {
		console.error('Stripe PDF download error:', await pdfResponse.text());
		throw new HTTPException(502, { message: 'Failed to download invoice PDF from provider.' });
	}

	// Stream the PDF back to the client with appropriate headers
	const headers = new Headers();
	headers.set('Content-Type', 'application/pdf');
	headers.set('Content-Disposition', `attachment; filename="invoice-${invoice.number || invoice.id}.pdf"`);
	const contentLength = pdfResponse.headers.get('content-length');
	if (contentLength) {
		headers.set('content-length', contentLength);
	}

	return new Response(pdfResponse.body, { status: 200, headers: headers });
});
