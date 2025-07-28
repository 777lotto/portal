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

export async function createStripePortalSession(stripe: Stripe, customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    return stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    });
}

export async function createStripeInvoice(c: Context<AppEnv>, lineItems: LineItem[]): Promise<Stripe.Invoice> {
    const stripe = getStripe(c.env);
    const user = c.get('user');

    if (!user.stripe_customer_id) {
        throw new Error("User does not have a Stripe customer ID.");
    }
    if (!lineItems || lineItems.length === 0) {
        throw new Error("Cannot create an invoice with no line items.");
    }

    const invoice = await stripe.invoices.create({
      customer: user.stripe_customer_id,
      collection_method: 'send_invoice',
      days_until_due: 30,
      auto_advance: false, // Create as draft
    });

    if (!invoice.id) {
      throw new Error("Failed to create a draft invoice in Stripe.");
    }

    for (const item of lineItems) {
      await stripe.invoiceItems.create({
        customer: user.stripe_customer_id,
        invoice: invoice.id,
        amount: item.unit_price_cents,
        quantity: item.quantity,
        description: item.description,
        currency: 'usd',
      });
    }

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    if (finalizedInvoice.id) {
      await stripe.invoices.sendInvoice(finalizedInvoice.id);
    }


    return finalizedInvoice;
}

export async function finalizeStripeInvoice(stripe: Stripe, invoiceId: string | undefined | null): Promise<Stripe.Invoice> {
  if (!invoiceId) {
    throw new Error('Cannot finalize an invoice with no ID.');
  }
  const finalInvoice = await stripe.invoices.finalizeInvoice(invoiceId);
  return finalInvoice;
}

// ADDED_START
export async function createDraftStripeInvoice(stripe: Stripe, customerId: string): Promise<Stripe.Invoice> {
    console.log(`Creating new draft Stripe invoice for customer: ${customerId}`);
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 30,
      auto_advance: false,
    });
    return invoice;
}

export async function listPaymentMethods(stripe: Stripe, customerId: string): Promise<Stripe.ApiList<Stripe.PaymentMethod>> {
    return stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
    });
}

export async function attachPaymentMethod(stripe: Stripe, paymentMethodId: string, customerId: string): Promise<Stripe.PaymentMethod> {
    return stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
    });
}

export async function updateCustomerDefaultPaymentMethod(stripe: Stripe, customerId: string, paymentMethodId: string): Promise<Stripe.Customer> {
    return stripe.customers.update(customerId, {
        invoice_settings: {
            default_payment_method: paymentMethodId,
        },
    });
}

export async function createSetupIntent(stripe: Stripe, customerId: string): Promise<Stripe.SetupIntent> {
    return stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
    });
}
// ADDED_END

export async function createStripeQuote(stripe: Stripe, customerId: string, lineItems: LineItem[]): Promise<Stripe.Quote> {
    console.log(`Creating new Stripe quote for customer: ${customerId}`);

    const line_items = lineItems.map(item => ({
        price_data: {
            currency: 'usd',
            product_data: {
                name: item.description,
            },
            amount: item.unit_price_cents,
        },
        quantity: item.quantity,
    }));

    const quote = await stripe.quotes.create({
        customer: customerId,
        collection_method: 'send_invoice',
        line_items: line_items as any,
    });

    return quote;
}

