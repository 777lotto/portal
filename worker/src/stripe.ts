// worker/src/stripe.ts - Fixed with correct API version and proper types
import Stripe from "stripe";
import type { Env } from "@portal/shared";

// Create a singleton Stripe instance
let stripeInstance: Stripe | null = null;

export function getStripe(env: Env): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-04-30.basil', // Your confirmed API version
      typescript: true, // Enable TypeScript support
    });
  }
  return stripeInstance;
}

export async function getOrCreateCustomer(
  env: Env,
  email: string,
  name: string,
  phone?: string
): Promise<string> {
  const stripe = getStripe(env);

  // Check if user already has a stripe_customer_id
  const result = await env.DB.prepare(
    `SELECT stripe_customer_id FROM users WHERE email = ?`
  ).bind(email).first();

  const existingRecord = result as { stripe_customer_id?: string } | null;
  if (existingRecord?.stripe_customer_id) {
    return existingRecord.stripe_customer_id;
  }

  // Create new Stripe customer with proper parameters
  const customerParams: Stripe.CustomerCreateParams = {
    email,
    name,
  };

  if (phone) {
    customerParams.phone = phone;
  }

  const customer = await stripe.customers.create(customerParams);

  // Save to D1
  await env.DB.prepare(
    `UPDATE users SET stripe_customer_id = ? WHERE email = ?`
  ).bind(customer.id, email).run();

  return customer.id;
}

export async function createAndSendInvoice(
  env: Env,
  customerId: string,
  amount_cents: number,
  description: string,
  daysUntilDue: number = 14
): Promise<Stripe.Invoice> {
  const stripe = getStripe(env);

  // Create invoice item
  await stripe.invoiceItems.create({
    customer: customerId,
    amount: amount_cents,
    currency: "usd",
    description,
  });

  // Create invoice
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: daysUntilDue,
    auto_advance: true, // Automatically finalize and send
  });

  // Finalize the invoice
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
  
  return finalizedInvoice;
}

// Helper function to search customers by email or phone
export async function findCustomerByIdentifier(
  env: Env,
  email?: string,
  phone?: string
): Promise<Stripe.Customer | null> {
  const stripe = getStripe(env);

  // Search by email first if provided
  if (email) {
    const customers = await stripe.customers.list({
      email: email,
      limit: 1
    });
    
    if (customers.data.length > 0) {
      return customers.data[0];
    }
  }

  // Search by phone if provided and email search didn't find anything
  if (phone) {
    const customers = await stripe.customers.search({
      query: `phone:'${phone.replace(/\D/g, '')}'`, // Remove non-digits for search
      limit: 1
    });
    
    if (customers.data.length > 0) {
      return customers.data[0];
    }
  }

  return null;
}

// Create customer portal session
export async function createPortalSession(
  env: Env,
  customerId: string,
  returnUrl: string = 'https://portal.777.foo/dashboard'
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe(env);
  
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
