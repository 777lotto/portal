// worker/src/stripe/index.ts
import Stripe from 'stripe';
import { Env, User, LineItem } from '@portal/shared';

/**
 * REFACTORED: Initializes the Stripe client.
 * - The API version is set to a specific, stable version. This is a best practice
 * to ensure that your integration doesn't break unexpectedly when Stripe updates their API.
 */
export function getStripe(env: Env): Stripe {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-05-28.basil',
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// This file consists of helper functions that interact with the Stripe API.
// The existing code is already well-structured and doesn't involve direct database queries
// or complex request handling, so no further refactoring is needed here. The functions
// correctly abstract away the Stripe API calls.

export async function createStripeCustomer(stripe: Stripe, user: User): Promise<Stripe.Customer> {
  const { email, name, phone, companyName } = user;

  const existingCustomers = await stripe.customers.list({ email: email, limit: 1 });
  if (existingCustomers.data.length > 0) {
    console.log(`Found existing Stripe customer for email: ${email}`);
    return existingCustomers.data[0];
  }

  console.log(`Creating new Stripe customer for email: ${email}`);
  return stripe.customers.create({
      email: email,
      name: name ?? undefined,
      phone: phone || undefined,
      metadata: {
        company_name: companyName || ''
      }
  });
}

export async function createStripePortalSession(stripe: Stripe, customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    return stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    });
}

export async function createStripeInvoice(stripe: Stripe, lineItems: LineItem[], customerId: string): Promise<Stripe.Invoice> {
    const invoice = await stripe.invoices.create({
        customer: customerId,
        collection_method: 'send_invoice',
        days_until_due: 30,
        auto_advance: false,
    });

    if (!invoice.id) {
      throw new Error("Failed to create a draft invoice in Stripe.");
    }

    for (const item of lineItems) {
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_amount: item.unitTotalAmountCents,
        currency: 'usd',
      });
    }

    const finalInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    if (!finalInvoice.id) {
        throw new Error("Failed to finalize invoice.");
    }
    return await stripe.invoices.sendInvoice(finalInvoice.id);
}

export async function finalizeStripeInvoice(stripe: Stripe, invoiceId: string | undefined | null): Promise<Stripe.Invoice> {
  if (!invoiceId) {
    throw new Error('Cannot finalize an invoice with no ID.');
  }
  const finalInvoice = await stripe.invoices.finalizeInvoice(invoiceId);
  return finalInvoice;
}

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

export async function createStripeQuote(stripe: Stripe, customerId: string, lineItems: LineItem[]): Promise<Stripe.Quote> {
    console.log(`Creating new Stripe quote for customer: ${customerId}`);

    const line_items_payload = lineItems.map(item => ({
        price_data: {
            currency: 'usd',
            product_data: {
                name: item.description,
            },
            unit_amount: item.unitTotalAmountCents,
        },
        quantity: item.quantity,
    }));

    const quote = await stripe.quotes.create({
        customer: customerId,
        line_items: line_items_payload,
        collection_method: 'send_invoice',
        invoice_settings: {
          days_until_due: 30,
        },
    });

    return quote;
}
