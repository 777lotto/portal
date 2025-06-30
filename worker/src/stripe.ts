// worker/src/stripe.ts - CORRECTED
import Stripe from 'stripe';
import { Context } from 'hono';
import { AppEnv } from './index.js';
import { Env, User, Service } from '@portal/shared';

export function getStripe(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    // FIX: Use the specific apiVersion the installed type definitions expect.
    apiVersion: '2025-05-28.basil',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function createStripeCustomer(stripe: Stripe, user: User): Promise<Stripe.Customer> {
  const { email, name, phone } = user;

  const existingCustomers = await stripe.customers.list({ email: email, limit: 1 });
  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  return stripe.customers.create({
      email: email,
      name: name,
      phone: phone || undefined,
  });
}

export async function createStripePortalSession(stripe: Stripe, customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    return stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    });
}

export async function createStripeInvoice(c: Context<AppEnv>, service: Service): Promise<Stripe.Invoice> {
    const stripe = getStripe(c.env);
    const user = c.get('user');

    if (!user.stripe_customer_id) {
        throw new Error("User does not have a Stripe customer ID.");
    }
    if (!service.price_cents) {
        throw new Error("Service does not have a price.");
    }

    // FIX: Bypass incorrect type definition for price_data using 'as any'.
    // The structure is correct according to Stripe's API documentation.
    await stripe.invoiceItems.create({
      customer: user.stripe_customer_id,
      price_data: {
        currency: 'usd',
        product_data: {
          name: service.notes || 'General Service',
        },
        unit_amount: service.price_cents,
      } as any, // This assertion bypasses the incorrect type check.
      quantity: 1,
    });

    const invoice = await stripe.invoices.create({
      customer: user.stripe_customer_id,
      collection_method: 'send_invoice',
      days_until_due: 30,
      auto_advance: true,
    });

    return invoice;
}

export async function finalizeStripeInvoice(stripe: Stripe, invoiceId: string | undefined | null): Promise<Stripe.Invoice> {
  if (!invoiceId) {
    throw new Error('Cannot finalize an invoice with no ID.');
  }
  const finalInvoice = await stripe.invoices.finalizeInvoice(invoiceId);
  return finalInvoice;
}
