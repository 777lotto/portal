// worker/src/handlers/admin/jobs.ts
import { Context } from 'hono';
import { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import type { Job, Service, User } from '@portal/shared';
import { getStripe } from '../../stripe.js';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

// Define the shape of our combined data
interface JobWithDetails extends Job {
  customerName: string;
  customerAddress: string;
  services: Service[];
}

export const handleGetJobsAndQuotes = async (c: Context<AppEnv>) => {
  const db = c.env.DB;
  try {
    // 1. Fetch all jobs with customer info
    const { results: jobs } = await db.prepare(
      `SELECT
         j.*,
         u.name as customerName,
         u.address as customerAddress
       FROM jobs j
       JOIN users u ON j.customerId = u.id
       ORDER BY j.createdAt DESC`
    ).all<Job & { customerName: string; customerAddress: string }>();

    if (!jobs) {
      return successResponse([]);
    }

    // 2. Fetch all services and map them by job_id for efficient lookup
    const { results: services } = await db.prepare(`SELECT * FROM services`).all<Service>();
    const servicesByJobId = new Map<string, Service[]>();
    if (services) {
      for (const service of services) {
        if (service.job_id) {
          if (!servicesByJobId.has(service.job_id)) {
            servicesByJobId.set(service.job_id, []);
          }
          servicesByJobId.get(service.job_id)!.push(service);
        }
      }
    }

    // 3. Combine jobs with their services
    const jobsWithDetails: JobWithDetails[] = jobs.map(job => ({
      ...job,
      services: servicesByJobId.get(job.id) || []
    }));

    return successResponse(jobsWithDetails);
  } catch (e: any) {
    console.error("Failed to get jobs and quotes:", e);
    return errorResponse("Failed to retrieve job data.", 500);
  }
};

export const handleAdminCreateJob = async (c: Context<AppEnv>) => {
    const { customerId, title, services, start } = await c.req.json();
    const db = c.env.DB;
    const stripe = getStripe(c.env);

    try {
        const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(customerId).first<User>();
        if (!user) return errorResponse("User not found.", 404);
        if (!user.stripe_customer_id) return errorResponse("This user does not have a Stripe customer ID.", 400);

        const newJobId = uuidv4();
        const totalAmountCents = services.reduce((acc: number, item: any) => acc + (item.price_cents || 0), 0);

        const draftInvoice = await stripe.invoices.create({
            customer: user.stripe_customer_id,
            collection_method: 'send_invoice',
            description: `Invoice for: ${title}`,
            auto_advance: false,
        });
        if (!draftInvoice.id) {
            return errorResponse("Failed to create a draft invoice.", 500);
        }

        for (const item of services) {
            await stripe.invoiceItems.create({
                customer: user.stripe_customer_id,
                invoice: draftInvoice.id,
                description: item.notes || 'Service',
                amount: item.price_cents || 0,
                currency: 'usd',
            });
        }

        const finalInvoice = await stripe.invoices.finalizeInvoice(draftInvoice.id);
        if (!finalInvoice?.id) {
            throw new Error('Failed to finalize invoice: No ID returned from Stripe.');
        }
        const sentInvoice = await stripe.invoices.sendInvoice(finalInvoice.id);

        await db.prepare(
            `INSERT INTO jobs (id, customerId, title, description, start, end, status, recurrence, total_amount_cents, stripe_invoice_id, invoice_created_at, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            newJobId,
            user.id.toString(),
            title,
            `Invoice created by admin`,
            start,
            start,
            'payment_pending',
            'none',
            totalAmountCents,
            sentInvoice.id,
            new Date().toISOString(),
            new Date().toISOString(),
            new Date().toISOString()
        ).run();

        const serviceInserts = services.map((item: any) =>
            db.prepare(`INSERT INTO services (user_id, job_id, service_date, status, notes, price_cents) VALUES (?, ?, ?, ?, ?, ?)`)
              .bind(user.id, newJobId, start, 'completed', item.notes, item.price_cents)
        );
        await db.batch(serviceInserts);


        await c.env.NOTIFICATION_QUEUE.send({
            type: 'invoice_created',
            userId: user.id,
            data: {
                invoiceId: sentInvoice.id,
                amount: sentInvoice.amount_due,
                dueDate: sentInvoice.due_date ? new Date(sentInvoice.due_date * 1000).toISOString() : new Date().toISOString(),
                invoiceUrl: sentInvoice.hosted_invoice_url,
            },
        });


        return successResponse({ message: `Job successfully created and sent.`, jobId: newJobId });
    } catch (e: any) {
        console.error(`Failed to create job for user ${customerId}:`, e);
        return errorResponse(`Failed to create job: ${e.message}`, 500);
    }
}

export const handleAdminCreateQuote = async (c: Context<AppEnv>) => {
    const { customerId, title, services, start } = await c.req.json();
    const db = c.env.DB;
    const stripe = getStripe(c.env);
     try {
        const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(customerId).first<User>();
        if (!user) return errorResponse("User not found.", 404);
        if (!user.stripe_customer_id) return errorResponse("This user does not have a Stripe customer ID.", 400);

        const newJobId = uuidv4();
        const totalAmountCents = services.reduce((acc: number, item: any) => acc + (item.price_cents || 0), 0);

        const quote = await stripe.quotes.create({
            customer: user.stripe_customer_id,
            description: title,
            line_items: services.map((item: any) => ({
                price_data: {
                    currency: 'usd',
                    unit_amount: item.price_cents || 0,
                    product_data: {
                        name: item.notes || 'Unnamed Service',
                    },
                },
                quantity: 1,
            })),
        });

        await db.prepare(
            `INSERT INTO jobs (id, customerId, title, description, start, end, status, recurrence, total_amount_cents, stripe_quote_id, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            newJobId,
            user.id.toString(),
            title,
            `Quote created by admin`,
            start,
            start,
            'pending_quote',
            'none',
            totalAmountCents,
            quote.id,
            new Date().toISOString(),
            new Date().toISOString()
        ).run();

        const serviceInserts = services.map((item: any) =>
            db.prepare(`INSERT INTO services (user_id, job_id, service_date, status, notes, price_cents) VALUES (?, ?, ?, ?, ?, ?)`)
              .bind(user.id, newJobId, start, 'pending', item.notes, item.price_cents)
        );
        await db.batch(serviceInserts);

        const finalizedQuote = await stripe.quotes.finalizeQuote(quote.id) as Stripe.Quote;

        await c.env.NOTIFICATION_QUEUE.send({
            type: 'quote_created',
            userId: user.id,
            data: {
                quoteId: finalizedQuote.id,
                quoteUrl: (finalizedQuote as any).hosted_details_url,
                customerName: user.name,
            },
        });


        return successResponse({ quoteId: quote.id, jobId: newJobId });

    } catch (e: any) {
        console.error(`Failed to create quote for user ${customerId}:`, e);
        return errorResponse(`Failed to create quote: ${e.message}`, 500);
    }
}
