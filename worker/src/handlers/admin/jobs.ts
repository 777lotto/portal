// worker/src/handlers/admin/jobs.ts
import { Context } from 'hono';
import { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import type { Job, Service, User, JobStatus, JobWithDetails } from '@portal/shared';
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
       JOIN users u ON j.customerId = u.id
       ORDER BY j.createdAt DESC`
    ).all<Job & { customerName: string; customerAddress: string }>();

    if (!jobs) {
      return successResponse([]);
    }

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


// REVISED AND CONSOLIDATED FUNCTION
export const handleAdminCreateJob = async (c: Context<AppEnv>) => {
    const { customerId, title, services, start, isDraft, jobType } = await c.req.json();
    const db = c.env.DB;
    const stripe = getStripe(c.env);

    if (!customerId || !title || !start || !services) {
        return errorResponse("Missing required fields: customerId, title, start, services.", 400);
    }

    try {
        const user = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(customerId).first<User>();
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
            start,
            end: new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString(),
            status,
            recurrence: 'none'
        };
        const newJob = await createJob(c.env, jobData, customerId);

        const serviceInserts = services.map((service: any) =>
            db.prepare(`INSERT INTO services (job_id, notes, price_cents) VALUES (?, ?, ?, ?, ?)`)
              .bind(newJob.id, start, 'pending', service.notes, service.price_cents)
        );
        await db.batch(serviceInserts);

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

                for (const service of services) {
                    await stripe.invoiceItems.create({
                        customer: user.stripe_customer_id,
                        invoice: draftInvoice.id,
                        description: service.notes,
                        amount: service.price_cents,
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
                    line_items: services.map((item: any) => ({
                        price_data: { currency: 'usd', unit_amount: item.price_cents || 0, product_data: { name: item.notes || 'Unnamed Service' } },
                        quantity: 1,
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
        console.error(`Failed to create ${jobType} for user ${customerId}:`, e);
        return errorResponse(`Failed to create ${jobType}: ${e.message}`, 500);
    }
};
