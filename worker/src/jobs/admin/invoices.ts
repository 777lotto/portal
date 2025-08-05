// worker/src/jobs/admin/invoices.ts

import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import Stripe from 'stripe';
import { getStripe } from '../../stripe';
import { db } from '../../db/client';
import * as schema from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../../server';

const factory = createFactory<AppEnv>();

// Note: The handlers that primarily interact with the Stripe API (getInvoice, addInvoiceItem, etc.)
// are already well-structured. The main refactoring effort is on handlers that
// interact heavily with our local database, like `importInvoices`.

export const getInvoice = factory.createHandlers(async (c) => {
  const { invoiceId } = c.req.param();
  const stripe = getStripe(c.env);
  const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['lines'] });
  return c.json({ invoice });
});

export const addInvoiceItem = factory.createHandlers(
  zValidator('json', z.object({
    description: z.string().min(1),
    amount: z.number().int().positive(),
  })),
  async (c) => {
    const { invoiceId } = c.req.param();
    const { description, amount } = c.req.valid('json');
    const stripe = getStripe(c.env);

    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.status !== 'draft') {
      throw new HTTPException(400, { message: 'Cannot add items to a finalized invoice.' });
    }

    const invoiceItem = await stripe.invoiceItems.create({
      customer: invoice.customer as string,
      invoice: invoiceId,
      description: description,
      // Note: Stripe expects amount in cents, which matches our schema.
      unit_amount: amount,
      currency: 'usd',
    });

    return c.json({ invoiceItem }, 201);
  }
);

export const deleteInvoiceItem = factory.createHandlers(async (c) => {
  const { itemId } = c.req.param();
  const stripe = getStripe(c.env);
  const deletedItem = await stripe.invoiceItems.del(itemId);
  return c.json({ deleted: deletedItem.deleted, id: deletedItem.id });
});

export const finalizeInvoice = factory.createHandlers(async (c) => {
  const { invoiceId } = c.req.param();
  const stripe = getStripe(c.env);
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoiceId);
  if(finalizedInvoice.id) {
    const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id);
    return c.json({ invoice: sentInvoice });
  }
  return c.json({ invoice: finalizedInvoice });
});

export const markInvoiceAsPaid = factory.createHandlers(async (c) => {
    const { invoiceId } = c.req.param();
    const stripe = getStripe(c.env);
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (invoice.status === 'paid') {
        throw new HTTPException(400, { message: 'Invoice is already paid.' });
    }
    const updatedInvoice = await stripe.invoices.pay(invoiceId, { paid_out_of_band: true });
    return c.json({ invoice: updatedInvoice });
});

/**
 * REFACTORED: Retrieves open invoices and enriches them with user data.
 * - Uses a single Drizzle query to fetch all necessary users at once.
 * - Uses a Map for efficient lookup to enrich the invoice data.
 */
export const getOpenInvoices = factory.createHandlers(async (c) => {
    const stripe = getStripe(c.env);
    const database = db(c.env.DB);
    const invoices: Stripe.ApiList<Stripe.Invoice> = await stripe.invoices.list({ status: 'open', limit: 100 });

    const stripeCustomerIds = invoices.data.map(inv => inv.customer).filter((id): id is string => !!id);
    if (stripeCustomerIds.length === 0) {
        return c.json({ invoices: [] });
    }

    const dbUsers = await database.query.users.findMany({
        where: inArray(schema.users.stripeCustomerId, stripeCustomerIds),
        columns: { id: true, name: true, stripeCustomerId: true }
    });

    const userMap = new Map(dbUsers.map((u: { stripeCustomerId: any; }) => [u.stripeCustomerId, u]));

    const enrichedInvoices = invoices.data.map(inv => {
        const user = userMap.get(inv.customer as string);
        return { ...inv, userId: user?.id, customerName: user?.name };
    });

    return c.json({ invoices: enrichedInvoices });
});


/**
 * REFACTORED: Imports paid Stripe invoices as completed jobs.
 * - Correctly maps Stripe invoice fields to our Drizzle schema fields (e.g., `title`, `description`).
 * - Fully type-safe and uses transactions for creating jobs and line items.
 */
export const importInvoices = factory.createHandlers(async (c) => {
  const { userId: userIdParam } = c.req.param();
  const stripe = getStripe(c.env);
  const database = db(c.env.DB);

  let importedCount = 0;
  let skippedCount = 0;
  let hasMore = true;
  let startingAfter: string | undefined = undefined;

  const listParams: Stripe.InvoiceListParams = { status: 'paid', limit: 100, expand: ['data.customer', 'data.lines.data'] };

  if (userIdParam) {
    const user = await database.query.users.findFirst({
        where: eq(schema.users.id, parseInt(userIdParam, 10)),
        columns: { stripeCustomerId: true }
    });
    if (!user?.stripeCustomerId) {
      throw new HTTPException(404, { message: 'User not found or does not have a Stripe customer ID.' });
    }
    listParams.customer = user.stripeCustomerId;
  }

  while (hasMore) {
    const invoices: Stripe.ApiList<Stripe.Invoice> = await stripe.invoices.list({ ...listParams, starting_after: startingAfter });
    if (invoices.data.length === 0) break;

    for (const invoice of invoices.data) {
      if (!invoice.lines?.data?.length || typeof invoice.customer !== 'object' || invoice.customer.deleted) {
        skippedCount++;
        continue;
      }

      const existingJob = await database.query.jobs.findFirst({ where: eq(schema.jobs.stripeInvoiceId, invoice.id), columns: { id: true } });
      if (existingJob) {
        skippedCount++;
        continue;
      }

      let user = await database.query.users.findFirst({ where: eq(schema.users.stripeCustomerId, invoice.customer.id), columns: { id: true } });
      if (!user) {
        const stripeCustomer = invoice.customer as Stripe.Customer;
        const [newUser] = await database.insert(schema.users).values({
            name: stripeCustomer.name || 'Stripe Customer',
            email: stripeCustomer.email,
            phone: stripeCustomer.phone,
            stripeCustomerId: invoice.customer.id,
            role: 'guest'
        }).returning({ id: schema.users.id });
        user = newUser;
      }

      if (!user) { skippedCount++; continue; }

      await database.transaction(async (tx) => {
        const jobTitle = invoice.lines.data[0]?.description || invoice.description || `Imported Job ${invoice.id}`;
        const [newJob] = await tx.insert(schema.jobs).values({
            userId: user.id.toString(),
            title: jobTitle,
            description: invoice.description || `Imported from Stripe Invoice #${invoice.number}`,
            status: 'complete',
            recurrence: 'none',
            stripeInvoiceId: invoice.id,
            createdAt: new Date(invoice.created * 1000).toISOString(),
            totalAmountCents: invoice.total,
            due: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : undefined,
        }).returning({ id: schema.jobs.id });

        const lineItemsToInsert = invoice.lines.data.map((item: any) => ({
            jobId: newJob.id,
            description: item.description || 'Imported Item',
            quantity: item.quantity || 1,
            unitTotalAmountCents: item.amount,
        }));

        if(lineItemsToInsert.length > 0) {
          await tx.insert(schema.lineItems).values(lineItemsToInsert);
        }
      });
      importedCount++;
    }

    startingAfter = invoices.data[invoices.data.length - 1].id;
    hasMore = invoices.has_more;
  }

  return c.json({ message: `Import complete.`, imported: importedCount, skipped: skippedCount });
});
