import Stripe from 'stripe';
import { Context } from 'hono';
import { AppEnv } from './index';
import { Env, User, Service } from '@portal/shared';

export function getStripe(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-04-10', // Or your desired API version
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function createStripeCustomer(stripe: Stripe, user: User): Promise<Stripe.Customer> {
  const { email, name, phone } = user;

  // Check for an existing customer with this email
  const existingCustomers = await stripe.customers.list({ email: email, limit: 1 });
  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  // FIX: Stripe's API expects `undefined` for missing values, not `null`.
  return stripe.customers.create({
      email: email,
      name: name,
      phone: phone || undefined, // Provide undefined if phone is null
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

    // Create an Invoice Item
    await stripe.invoiceItems.create({
      customer: user.stripe_customer_id,
      price_data: {
        currency: 'usd',
        product_data: {
          name: service.notes || 'General Service',
        },
        unit_amount: service.price_cents,
      },
      quantity: 1,
    });

    // Create an Invoice
    const invoice = await stripe.invoices.create({
      customer: user.stripe_customer_id,
      collection_method: 'send_invoice',
      days_until_due: 30,
      auto_advance: true, // Automatically finalize and send the invoice
    });

    return invoice;
}

export async function finalizeStripeInvoice(stripe: Stripe, invoiceId: string | undefined | null): Promise<Stripe.Invoice> {
  // Add a check to ensure invoice.id is a string before calling the API.
  if (!invoiceId) {
    throw new Error('Cannot finalize an invoice with no ID.');
  }
  const finalInvoice = await stripe.invoices.finalizeInvoice(invoiceId);
  return finalInvoice;
}

