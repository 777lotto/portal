// worker/src/jobs/admin/invoices.ts
import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import Stripe from 'stripe';
import { getStripe } from '../../stripe';
import { jobs, lineItems, users } from '@portal/shared/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

const factory = createFactory();

// --- REFACTORED: All handlers now use the createFactory pattern ---
// - Removed try/catch blocks and manual response helpers.
// - All database queries are now using Drizzle ORM.
// - Added input validation with zValidator where applicable.

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
      amount: amount,
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
  const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id);
  return c.json({ invoice: sentInvoice });
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

export const getOpenInvoices = factory.createHandlers(async (c) => {
    const stripe = getStripe(c.env);
    const invoices = await stripe.invoices.list({ status: 'open', limit: 100 });
    const stripeCustomerIds = invoices.data.map(inv => inv.customer).filter((id): id is string => !!id);

    if (stripeCustomerIds.length === 0) {
        return c.json({ invoices: [] });
    }

    const dbUsers = await c.env.db.query.users.findMany({
        where: inArray(users.stripe_customer_id, stripeCustomerIds),
        columns: { id: true, name: true, stripe_customer_id: true }
    });

    const userMap = new Map(dbUsers.map(u => [u.stripe_customer_id, u]));

    const enrichedInvoices = invoices.data.map(inv => {
        const user = userMap.get(inv.customer as string);
        return {
            ...inv,
            user_id: user?.id,
            customerName: user?.name,
        };
    });

    return c.json({ invoices: enrichedInvoices });
});


/**
 * REFACTORED: Invoice Import Handler
 * - This complex function is now fully converted to use Drizzle ORM.
 * - The logic is clearer, more maintainable, and fully type-safe.
 * - It efficiently finds or creates users and checks for existing jobs before importing.
 */
export const importInvoices = factory.createHandlers(async (c) => {
  const { user_id } = c.req.param();
  const stripe = getStripe(c.env);
  const db = c.env.db;

  let importedCount = 0;
  let skippedCount = 0;
  let hasMore = true;
  let startingAfter: string | undefined = undefined;

  const listParams: Stripe.InvoiceListParams = { status: 'paid', limit: 100, expand: ['data.customer', 'data.lines.data'] };

  if (user_id) {
    const user = await db.query.users.findFirst({
        where: eq(users.id, user_id),
        columns: { stripe_customer_id: true }
    });
    if (!user?.stripe_customer_id) {
      throw new HTTPException(404, { message: 'User not found or does not have a Stripe customer ID.' });
    }
    listParams.customer = user.stripe_customer_id;
  }

  while (hasMore) {
    const invoices = await stripe.invoices.list({ ...listParams, starting_after: startingAfter });
    if (invoices.data.length === 0) break;

    for (const invoice of invoices.data) {
      if (!invoice.lines?.data?.length || typeof invoice.customer !== 'object' || invoice.customer.deleted) {
        skippedCount++;
        continue;
      }

      const existingJob = await db.query.jobs.findFirst({ where: eq(jobs.stripe_invoice_id, invoice.id), columns: { id: true } });
      if (existingJob) {
        skippedCount++;
        continue;
      }

      let user = await db.query.users.findFirst({ where: eq(users.stripe_customer_id, invoice.customer.id), columns: { id: true } });
      if (!user) {
        const stripeCustomer = invoice.customer as Stripe.Customer;
        const [newUser] = await db.insert(users).values({
            name: stripeCustomer.name || 'Stripe Customer',
            email: stripeCustomer.email,
            phone: stripeCustomer.phone,
            stripe_customer_id: invoice.customer.id,
            role: 'guest'
        }).returning({ id: users.id });
        user = newUser;
      }

      if (!user) {
          skippedCount++;
          continue;
      }

      const jobTitle = invoice.lines.data[0]?.description || invoice.description || `Imported Job ${invoice.id}`;
      const [newJob] = await db.insert(jobs).values({
          userId: user.id,
          job_title: jobTitle,
          job_description: invoice.description || `Imported from Stripe Invoice #${invoice.number}`,
          status: 'complete',
          recurrence_rule: 'none',
          stripe_invoice_id: invoice.id,
          createdAt: new Date(invoice.created * 1000).toISOString(),
          total_amount_cents: invoice.total,
          job_due_date: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
      }).returning({ id: jobs.id });

      const lineItemsToInsert = invoice.lines.data.map(item => ({
          jobId: newJob.id,
          description: item.description || 'Imported Item',
          quantity: item.quantity || 1,
          unit_total_amount_cents: item.amount,
      }));

      if(lineItemsToInsert.length > 0) {
        await db.insert(lineItems).values(lineItemsToInsert);
      }

      importedCount++;
    }

    startingAfter = invoices.data[invoices.data.length - 1].id;
    hasMore = invoices.has_more;
  }

  return c.json({ message: `Import complete.`, imported: importedCount, skipped: skippedCount });
});
