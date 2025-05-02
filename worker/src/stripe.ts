// worker/src/stripe.ts
import Stripe from "stripe";
import type { Env } from "./env";

export function getStripe(env: Env) {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-04-30.basil",   // current stable
  });
}

export async function getOrCreateCustomer(
  env: Env,
  email: string,
  name: string
): Promise<string> {
  const stripe = getStripe(env);

  // check if user already has a stripe_customer_id
  const { stripe_customer_id } = await env.DB.prepare(
    `SELECT stripe_customer_id FROM users WHERE email = ?`
  ).bind(email).first() as { stripe_customer_id: string | null };

  if (stripe_customer_id) return stripe_customer_id;

  // create new Stripe customer
  const customer = await stripe.customers.create({ email, name });

  // save to D1
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
) {
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

  await stripe.invoices.finalizeInvoice(invoice.id);
  return invoice;
}
