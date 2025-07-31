// worker/src/stripe.ts - CORRECTED
import Stripe from 'stripe';
import { Context } from 'hono';
import { AppEnv } from './index.js';
import { Env, User, LineItem } from '@portal/shared';

export function getStripe(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    // FIX: Use the latest stable apiVersion
    apiVersion: '2025-05-28.basil',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export async function createStripeCustomer(stripe: Stripe, user: User): Promise<Stripe.Customer> {
  const { email, name, phone, company_name } = user;

  const existingCustomers = await stripe.customers.list({ email: email, limit: 1 });
  if (existingCustomers.data.length > 0) {
    console.log(`Found existing Stripe customer for email: ${email}`);
    return existingCustomers.data[0];
  }

  console.log(`Creating new Stripe customer for email: ${email}`);
  return stripe.customers.create({
      email: email,
      name: name,
      phone: phone || undefined,
      metadata: {
        company_name: company_name || ''
      }
  });
}

export async function createStripePortalSession(stripe: Stripe, user_id: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    return stripe.billingPortal.sessions.create({
        customer: user_id,
        return_url: returnUrl,
    });
}

export async function createStripeInvoice(c: Context<AppEnv>, lineItems: LineItem[]): Promise<Stripe.Invoice> {
    const stripe = c.env.STRIPE;
    const user = c.get('user');

    const invoice = await stripe.invoices.create({
        customer: user.stripe_customer_id,
        collection_method: 'send_invoice',
        days_until_due: 30,
    });

    for (const item of lineItems) {
      await stripe.invoiceItems.create({
        customer: user.stripe_customer_id,
        invoice: invoice.id,
        // Corrected: 'unit_total_amount_cents' is the correct property name
        amount: item.unit_total_amount_cents,
        // Corrected: 'quantity' is the correct property name
        quantity: item.quantity,
        // Corrected: 'description' is the correct property name
        description: item.description,
        currency: 'usd',
      });
    }

    return await stripe.invoices.sendInvoice(invoice.id);
}

export async function finalizeStripeInvoice(stripe: Stripe, invoiceId: string | undefined | null): Promise<Stripe.Invoice> {
  if (!invoiceId) {
    throw new Error('Cannot finalize an invoice with no ID.');
  }
  const finalInvoice = await stripe.invoices.finalizeInvoice(invoiceId);
  return finalInvoice;
}

// ADDED_START
export async function createDraftStripeInvoice(stripe: Stripe, user_id: string): Promise<Stripe.Invoice> {
    console.log(`Creating new draft Stripe invoice for customer: ${user_id}`);
    const invoice = await stripe.invoices.create({
      customer: user_id,
      collection_method: 'send_invoice',
      days_until_due: 30,
      auto_advance: false,
    });
    return invoice;
}

export async function listPaymentMethods(stripe: Stripe, user_id: string): Promise<Stripe.ApiList<Stripe.PaymentMethod>> {
    return stripe.paymentMethods.list({
        customer: user_id,
        type: 'card',
    });
}

export async function attachPaymentMethod(stripe: Stripe, paymentMethodId: string, user_id: string): Promise<Stripe.PaymentMethod> {
    return stripe.paymentMethods.attach(paymentMethodId, {
        customer: user_id,
    });
}

export async function updateCustomerDefaultPaymentMethod(stripe: Stripe, user_id: string, paymentMethodId: string): Promise<Stripe.Customer> {
    return stripe.customers.update(user_id, {
        invoice_settings: {
            default_payment_method: paymentMethodId,
        },
    });
}

export async function createSetupIntent(stripe: Stripe, user_id: string): Promise<Stripe.SetupIntent> {
    return stripe.setupIntents.create({
        customer: user_id,
        payment_method_types: ['card'],
    });
}
// ADDED_END

export async function createStripeQuote(stripe: Stripe, user_id: string, lineItems: LineItem[]): Promise<Stripe.Quote> {
    const user: { stripe_customer_id: string } = await stripe.customers.retrieve(user_id) as any;

    const line_items = lineItems.map(item => ({
        price_data: {
            currency: 'usd',
            product_data: {
                // Corrected: 'description' is the correct property name
                name: item.description,
            },
            // Corrected: 'unit_total_amount_cents' is the correct property name
            unit_amount: item.unit_total_amount_cents,
        },
        // Corrected: 'quantity' is the correct property name
        quantity: item.quantity,
    }));

    return await stripe.quotes.create({
        customer: user.stripe_customer_id,
        line_items,
    });
}

