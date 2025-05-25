// worker/src/stripe.ts - Fixed with correct Stripe API version and proper types
import Stripe from "stripe";
import type { Env } from "./env";

// Create a singleton Stripe instance
let stripeInstance: Stripe | null = null;

export function getStripe(env: Env): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2022-11-15',
    });
  }
  return stripeInstance;
}

export async function getOrCreateCustomer(
  env: Env,
  email: string,
  name: string
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

  // Create new Stripe customer
  const customer = await stripe.customers.create({ email, name });

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
  description: string
): Promise<Stripe.Invoice> {
  const stripe = getStripe(env);

  await stripe.invoiceItems.create({
    customer: customerId,
    amount: amount_cents,
    currency: "usd",
    description,
  });

  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: 0,
  });

  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
  return finalizedInvoice;
}
