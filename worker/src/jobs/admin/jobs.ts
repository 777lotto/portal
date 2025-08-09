// worker/src/jobs/admin/jobs.ts

import { Context } from 'hono';
import Stripe from 'stripe';
import { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import type { Job, LineItem, JobWithDetails } from '@portal/shared';
import { CreateJobPayloadSchema, JobStatusEnum } from '@portal/shared';
import { z } from 'zod';

// This function remains as it was, used for fetching and displaying data.
export async function handleGetAllJobs(c: Context<AppEnv>): Promise<Response> {
  try {
    const dbResponse = await c.env.DB.prepare(
      `SELECT
        j.id, j.title, j.createdAt as start, j.due as end, j.status,
        u.name as userName, u.id as userId
      FROM jobs j
      JOIN users u ON j.user_id = CAST(u.id AS TEXT)
      ORDER BY j.createdAt DESC`
    ).all();
    const jobs = dbResponse?.results || [];
    return successResponse(jobs);
  } catch (e: any) {
    console.error("Error in handleGetAllJobs:", e);
    return errorResponse("Failed to fetch all jobs.", 500);
  }
}


export const handleGetAllJobDetails = async (c: Context<AppEnv>) => {
  const db = c.env.DB;
  try {
    const { results: jobs } = await db.prepare(
      `SELECT
         j.*,
         u.name as customerName,
         u.address as customerAddress
       FROM jobs j
       JOIN users u ON j.user_id = CAST(u.id AS TEXT)
       ORDER BY j.createdAt DESC`
    ).all<Job & { customerName: string; customerAddress: string }>();

    if (!jobs) {
      return successResponse([]);
    }

    const jobsWithDetails: JobWithDetails[] = [];

    for (const job of jobs) {
      const { results: lineItems } = await db.prepare(
        `SELECT * FROM line_items WHERE job_id = ?`
      ).bind(job.id).all<LineItem>();

      jobsWithDetails.push({
        ...job,
        line_items: lineItems || [],
      });
    }

    return successResponse(jobsWithDetails);
  } catch (e: any) {
    console.error("Error in adminGetJobsAndQuotes:", e);
    return errorResponse("Failed to retrieve job list with details.", 500);
  }
};


/**
 * UPDATED AND FIXED: Handles job creation with Stripe integration.
 */
export const handleAdminCreateJob = async (c: Context<AppEnv>) => {
  const db = c.env.DB;
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-05-28.basil',
  });

  try {
    const body = await c.req.json();
    const validation = CreateJobPayloadSchema.safeParse(body);

    if (!validation.success) {
      const errorMessage = validation.error.flatten();
      return errorResponse(JSON.stringify(errorMessage), 400);
    }

    const {
      user_id,
      title,
      description,
      lineItems,
      jobType,
      recurrence,
      due,
      start,
      end,
      action,
    } = validation.data;

    const userIntegerId = parseInt(user_id, 10);
    if (isNaN(userIntegerId)) {
        return errorResponse('Invalid user ID format.', 400);
    }

    const userResult = await db.prepare(
        `SELECT stripe_customer_id FROM users WHERE id = ?`
    ).bind(userIntegerId).first<{ stripe_customer_id: string }>();

    if (!userResult?.stripe_customer_id) {
        return errorResponse('Stripe customer not found for this user.', 404);
    }
    const stripeCustomerId = userResult.stripe_customer_id;

    let job_status: z.infer<typeof JobStatusEnum>;
    let stripe_quote_id: string | null = null;
    let stripe_invoice_id: string | null = null;
    const newJobId = crypto.randomUUID();

    // CORRECTED: Use a double type assertion (via unknown) to satisfy the strict compiler.
    const stripeLineItems = lineItems.map(li => ({
        price_data: {
            currency: 'usd',
            product_data: { name: li.description },
            unit_amount: li.unit_total_amount_cents,
        },
        quantity: li.quantity,
    })) as unknown as Stripe.QuoteCreateParams.LineItem[];

    switch (action) {
      case 'send_proposal': {
        job_status = 'pending';
        const quote = await stripe.quotes.create({
          customer: stripeCustomerId,
          line_items: stripeLineItems,
          description: description,
          header: title,
        });
        const finalizedQuote = await stripe.quotes.finalizeQuote(quote.id);
        stripe_quote_id = finalizedQuote.id;
        break;
      }

      case 'send_finalized': {
        job_status = 'upcoming';
        const quote = await stripe.quotes.create({
          customer: stripeCustomerId,
          line_items: stripeLineItems,
          description: description,
          header: title,
        });
        const finalizedQuote = await stripe.quotes.finalizeQuote(quote.id);
        const acceptedQuote = await stripe.quotes.accept(finalizedQuote.id);
        stripe_quote_id = acceptedQuote.id;
        break;
      }

      case 'send_invoice': {
        job_status = 'payment_needed';
        const invoice = await stripe.invoices.create({
            customer: stripeCustomerId,
            collection_method: 'send_invoice',
            description: description,
            due_date: due ? Math.floor(new Date(due).getTime() / 1000) : undefined,
        });

        if (!invoice || !invoice.id) {
            return errorResponse('Failed to create a draft invoice in Stripe.', 500);
        }

        for (const item of lineItems) {
            await stripe.invoiceItems.create({
                invoice: invoice.id,
                customer: stripeCustomerId,
                amount: item.unit_total_amount_cents * item.quantity,
                description: item.description,
            });
        }

        const sentInvoice = await stripe.invoices.sendInvoice(invoice.id);
        if (!sentInvoice || !sentInvoice.id) {
            return errorResponse('Failed to send the finalized invoice from Stripe.', 500);
        }
        stripe_invoice_id = sentInvoice.id;
        break;
      }

      case 'post': {
          job_status = 'upcoming';
          break;
      }

      case 'draft':
      default: {
        job_status = 'draft';
        break;
      }
    }

    const total_amount_cents = lineItems.reduce((sum, item) => sum + (item.unit_total_amount_cents * item.quantity), 0);
    const statements = [];

    statements.push(
      db.prepare(
        `INSERT INTO jobs (id, user_id, title, description, status, recurrence, total_amount_cents, due, stripe_quote_id, stripe_invoice_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(newJobId, user_id, title, description || null, job_status, recurrence || null, total_amount_cents, due || null, stripe_quote_id, stripe_invoice_id)
    );

    for (const item of lineItems) {
      statements.push(
        db.prepare(
          `INSERT INTO line_items (job_id, description, unit_total_amount_cents, quantity) VALUES (?, ?, ?, ?)`
        ).bind(newJobId, item.description, item.unit_total_amount_cents, item.quantity)
      );
    }

    if (start && end) {
      statements.push(
        db.prepare(
          `INSERT INTO calendar_events (title, start, "end", type, job_id, user_id)
           VALUES (?, ?, ?, 'job', ?, ?)`
        ).bind(title, start, end, newJobId, userIntegerId)
      );
    }

    await db.batch(statements);

    try {
        const jobTypeName = jobType.charAt(0).toUpperCase() + jobType.slice(1);
        const message = `A new ${jobTypeName} has been posted to your account.`;
        const link = `/job/${newJobId}`;
        await c.env.DB.prepare(
            `INSERT INTO notifications (user_id, type, message, link, channels, status) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(userIntegerId, `new_${jobType}`, message, link, JSON.stringify(['ui']), 'sent').run();
    } catch (e) {
        console.error(`Failed to create UI notification for new ${jobType}`, e);
    }

    return c.json({ message: 'Job created successfully', jobId: newJobId }, 201);

  } catch (e: any) {
    console.error('Failed to create job:', e);
    const errorMessage = e instanceof Stripe.errors.StripeError ? e.message : 'An internal error occurred.';
    return errorResponse(errorMessage, 500);
  }
};
