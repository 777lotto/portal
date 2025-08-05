// worker/src/stripe/webhook.ts
import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import Stripe from 'stripe';
import { getStripe } from './index';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import type { AppEnv } from '../server';
import { db } from '../db/client';

const factory = createFactory<AppEnv>();

/**
 * REFACTORED: Stripe Webhook Handler
 * - All database operations now use the Drizzle ORM for full type safety.
 * - Removed manual try/catch; relies on the global error handler.
 * - Simplified logic for finding users and updating records.
 */
export const handleStripeWebhook = factory.createHandlers(async (c) => {
  const stripe = getStripe(c.env);
  const signature = c.req.header('stripe-signature');
  if (!signature) {
    throw new HTTPException(400, { message: 'Webhook Error: No signature provided' });
  }

  const body = await c.req.text();
  const event = await stripe.webhooks.constructEventAsync(
    body,
    signature,
    c.env.STRIPE_WEBHOOK_SECRET
  );
  const database = db(c.env.DB);

  // Handle the event
  switch (event.type) {
    case 'invoice.paid': {
      const invoicePaid = event.data.object as Stripe.Invoice;
      console.log(`Invoice ${invoicePaid.id} was paid successfully.`);

      // Find the user associated with the Stripe customer ID
      const userPaid = await database.query.users.findFirst({
        where: eq(schema.users.stripeCustomerId, invoicePaid.customer as string),
        columns: { id: true },
      });

      // Create a UI notification for the customer
      if (userPaid) {
        await database.insert(schema.notifications).values({
          userId: userPaid.id,
          type: 'invoice_paid',
          message: `Payment of ${(invoicePaid.amount_paid / 100).toFixed(2)} for invoice #${invoicePaid.number} was successful.`,
          link: '/account',
          status: 'unread',
        });
      }

      // Update the job's status to 'complete'
      await database
        .update(schema.jobs)
        .set({ status: 'complete' })
        .where(eq(schema.jobs.stripeInvoiceId, invoicePaid.id));
      break;
    }

    case 'invoice.created': {
      const invoiceCreated = event.data.object as any;
      console.log(`Invoice ${invoiceCreated.id} was created.`);
      if (invoiceCreated.quote) {
        // When an invoice is created from a quote, update the job status
        await database
          .update(schema.jobs)
          .set({
            stripeInvoiceId: invoiceCreated.id,
            status: 'payment_needed',
          })
          .where(eq(schema.jobs.stripeQuoteId, invoiceCreated.quote));
      }
      break;
    }

    case 'quote.accepted': {
      const quoteAccepted = event.data.object as Stripe.Quote;
      console.log(`Quote ${quoteAccepted.id} was accepted.`);
      await database
        .update(schema.jobs)
        .set({ status: 'upcoming' })
        .where(eq(schema.jobs.stripeQuoteId, quoteAccepted.id));
      break;
    }

    case 'quote.finalized': {
      const quote = event.data.object as Stripe.Quote;
      console.log(`Quote ${quote.id} was finalized.`);

      // Update job status to 'upcoming'
      await database
        .update(schema.jobs)
        .set({ status: 'upcoming' })
        .where(eq(schema.jobs.stripeQuoteId, quote.id));

      // Notify admins that a quote was accepted
      const customer = await stripe.customers.retrieve(quote.customer as string);
      const customerName = (customer as Stripe.Customer).name || 'A customer';

      const admins = await database.query.users.findMany({
          where: eq(schema.users.role, 'admin'),
          columns: { id: true }
      });

      for (const admin of admins) {
          await c.env.NOTIFICATION_QUEUE.send({
              type: 'quote_accepted',
              userId: admin.id,
              data: {
                  quoteId: quote.id,
                  customerName: customerName
              },
              channels: ['email']
          });
      }
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return c.json({ received: true });
});
