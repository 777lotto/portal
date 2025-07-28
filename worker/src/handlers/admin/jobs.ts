// worker/src/handlers/admin/jobs.ts
import { Context } from 'hono';
import { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import type { Job, LineItem, User, JobStatus, JobWithDetails } from '@portal/shared';
import { getStripe, createStripeCustomer, createDraftStripeInvoice } from '../../stripe.js';
import { createJob } from '../../calendar.js';
import Stripe from 'stripe';

// This function remains as it was, used for fetching and displaying data.
export const handleGetJobsAndQuotes = async (c: Context<AppEnv>) => {
  const db = c.env.DB;
  try {
    const { results: jobs } = await db.prepare(
      `SELECT
         j.*,
         u.name as customerName,
         u.address as customerAddress
       FROM jobs j
       JOIN users u ON j.user_id = u.id
       ORDER BY j.created_at DESC`
    ).all<Job & { customerName: string; customerAddress: string }>();

    if (!jobs) {
      return successResponse([]);
    }

    const { results: lineItems } = await db.prepare(`SELECT * FROM line_items`).all<LineItem>();
    const lineItemsByJobId = new Map<string, LineItem[]>();
    if (lineItems) {
      for (const item of lineItems) {
        if (item.job_id) {
          if (!lineItemsByJobId.has(item.job_id)) {
            lineItemsByJobId.set(item.job_id, []);
          }
          lineItemsByJobId.get(item.job_id)!.push(item);
        }
      }
    }

    const jobsWithDetails: JobWithDetails[] = jobs.map(job => ({
      ...job,
      line_items: lineItemsByJobId.get(job.id) || []
    }));

    return successResponse(jobsWithDetails);
  } catch (e: any) {
    console.error("Failed to get jobs and quotes:", e);
    return errorResponse("Failed to retrieve job data.", 500);
  }
};


// REVISED AND CONSOLIDATED FUNCTION
export const handleAdminCreateJob = async (c: Context<AppEnv>) => {
    const { userId, title, lineItems, isDraft, jobType } = await c.req.json();
    const db = c.env.DB;
    const stripe = getStripe(c.env);

    if (!userId || !title || !lineItems) {
        return errorResponse("Missing required fields: userId, title, lineItems.", 400);
    }

    try {
        const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first<User>();
        if (!user) return errorResponse("User not found.", 404);

        let status: JobStatus;
        if (isDraft) {
            status = jobType === 'quote' ? 'quote_draft' : 'invoice_draft';
        } else {
             switch (jobType) {
                case 'quote': status = 'pending'; break;
                case 'invoice': status = 'payment_needed'; break;
                default: status = 'upcoming';
            }
        }

        const jobData = {
            title,
            description: `Created via admin panel on ${new Date().toLocaleDateString()}`,
            job_status: status,
            recurrence: 'none'
        };
        const newJob = await createJob(c.env, jobData, userId);

        const lineItemInserts = lineItems.map((item: any) =>
            db.prepare(`INSERT INTO line_items (job_id, description, quantity, unit_price_cents) VALUES (?, ?, ?, ?)`)
              .bind(newJob.id, item.description, item.quantity, item.unit_price_cents)
        );
        await db.batch(lineItemInserts);

        let stripeObject = null;

        if (!isDraft) {
            if (!user.stripe_customer_id) {
                const stripeCustomer = await createStripeCustomer(stripe, user);
                await db.prepare(`UPDATE users SET stripe_customer_id = ? WHERE id = ?`).bind(stripeCustomer.id, user.id).run();
                user.stripe_customer_id = stripeCustomer.id;
            }

            if (jobType === 'invoice') {
                const draftInvoice = await createDraftStripeInvoice(stripe, user.stripe_customer_id);
                if (!draftInvoice || !draftInvoice.id) {
                    return errorResponse("Failed to create a valid draft invoice in Stripe.", 500);
                }

                for (const item of lineItems) {
                    await stripe.invoiceItems.create({
                        customer: user.stripe_customer_id,
                        invoice: draftInvoice.id,
                        description: item.description,
                        quantity: item.quantity,
                        unit_price: item.unit_price_cents,
                        currency: 'usd',
                    });
                }
                const finalInvoice = await stripe.invoices.sendInvoice(draftInvoice.id);
                await db.prepare(`UPDATE jobs SET stripe_invoice_id = ? WHERE id = ?`).bind(finalInvoice.id, newJob.id).run();
                stripeObject = finalInvoice;

            } else if (jobType === 'quote') {
                const quote = await stripe.quotes.create({
                    customer: user.stripe_customer_id,
                    description: title,
                    line_items: lineItems.map((item: any) => ({
                        price_data: { currency: 'usd', unit_amount: item.unit_price_cents || 0, product_data: { name: item.description || 'Unnamed Item' } },
                        quantity: item.quantity,
                    })),
                });
                const finalizedQuote = await stripe.quotes.finalizeQuote(quote.id) as Stripe.Quote;
                await db.prepare(`UPDATE jobs SET stripe_quote_id = ? WHERE id = ?`).bind(finalizedQuote.id, newJob.id).run();
                 await c.env.NOTIFICATION_QUEUE.send({
                    type: 'quote_created',
                    userId: user.id,
                    data: { quoteUrl: (finalizedQuote as any).hosted_details_url, customerName: user.name, },
                });
                stripeObject = finalizedQuote;
            }
        }

        return successResponse({
            message: `${jobType} successfully created.`,
            job: newJob,
            ...(stripeObject && { [jobType]: stripeObject })
        }, 201);

    } catch (e: any) {
        console.error(`Failed to create ${jobType} for user ${userId}:`, e);
        return errorResponse(`Failed to create ${jobType}: ${e.message}`, 500);
    }
};

