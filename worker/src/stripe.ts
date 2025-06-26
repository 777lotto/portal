// worker/src/stripe.ts - CORRECTED with missing functions

import Stripe from 'stripe';
import type { Env, User, Service } from '@portal/shared';

export const getStripe = (env: Env) => {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-05-28.basil', // Or your desired version
    httpClient: Stripe.createFetchHttpClient(),
  });
};

export const getOrCreateCustomer = async (
  user: Pick<User, 'email' | 'name' | 'phone'>,
  env: Env
): Promise<Stripe.Customer> => {
  const stripe = getStripe(env);
  const { email, name, phone } = user;

  const customers = await stripe.customers.list({ email, limit: 1 });
  if (customers.data.length > 0) {
    return customers.data[0];
  }

  return stripe.customers.create({ email, name, phone });
};

export const createPortalSession = async (
    customerId: string,
    env: Env
): Promise<string> => {
    const stripe = getStripe(env);
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: env.PORTAL_URL, // Make sure PORTAL_URL is in your .dev.vars
    });
    return session.url;
}

export const createInvoiceForService = async (
    serviceId: number,
    customerId: string,
    env: Env
): Promise<string> => {
    const stripe = getStripe(env);
    const service = await env.DB.prepare("SELECT * FROM services WHERE id = ?").bind(serviceId).first<Service>();

    if (!service || !service.price_cents) {
        throw new Error("Service not found or has no price.");
    }

    // Create an invoice item
    await stripe.invoiceItems.create({
        customer: customerId,
        amount: service.price_cents,
        currency: 'usd', // Or your default currency
        description: `Service on ${new Date(service.service_date).toLocaleDateString()}`,
    });

    // Create the invoice itself
    const invoice = await stripe.invoices.create({
        customer: customerId,
        collection_method: 'send_invoice',
        days_until_due: 30,
        auto_advance: true,
    });

    // Finalize the draft invoice
    const finalInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    if (!finalInvoice.hosted_invoice_url) {
        throw new Error("Could not create hosted invoice URL.");
    }

    // Update your DB with the Stripe Invoice ID
    await env.DB.prepare("UPDATE services SET stripe_invoice_id = ? WHERE id = ?")
        .bind(finalInvoice.id, serviceId)
        .run();

    return finalInvoice.hosted_invoice_url;
}


// This function will contain the logic to handle various Stripe webhook events
export const handleStripeEvent = async (signature: string, body: string, env: Env) => {
    const stripe = getStripe(env);
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        throw new Error(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'invoice.payment_succeeded':
            const invoice = event.data.object as Stripe.Invoice;
            console.log(`Invoice ${invoice.id} was paid successfully!`);
            // Here you would update the service status in your DB to 'paid'
            break;
        // ... handle other event types
        default:
            console.log(`Unhandled event type ${event.type}`);
    }
};
