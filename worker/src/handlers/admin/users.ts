// 777lotto/portal/portal-bet/worker/src/handlers/admin/users.ts

import { errorResponse, successResponse } from '../../utils.js';
import { Context } from 'hono';
import type { AppEnv } from '../../index.js';
import { getStripe, createStripeCustomer, createDraftStripeInvoice } from '../../stripe.js';
// MODIFIED: Imported 'Note' and 'PhotoWithNotes' and removed the unused 'Photo' type.
import { createJob } from '../../calendar.js'
import type { User, Job, Service, Env, Note, PhotoWithNotes } from '@portal/shared';

export async function handleGetAllUsers(c: Context<AppEnv>): Promise<Response> {
  const env = c.env;
  try {
    const dbResponse = await env.DB.prepare(
      `SELECT id, email, name, phone, role, stripe_customer_id, company_name FROM users ORDER BY id DESC`
    ).all<User>();
    const users = dbResponse?.results || [];
    return successResponse(users);
  } catch (e: any) {
    console.error("Error fetching all users:", e);
    return errorResponse('Failed to fetch users.', 500);
  }
}

export async function handleAdminGetJobsForUser(c: Context<AppEnv>): Promise<Response> {
    const { userId } = c.req.param();
    try {
        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE customerId = ? ORDER BY start DESC`
        ).bind(userId).all<Job>();
        const jobs = dbResponse?.results || [];
        return successResponse(jobs);
    } catch (e: any) {
        console.error(`Failed to get jobs for user ${userId}:`, e);
        return errorResponse("Failed to retrieve jobs for user.", 500);
    }
}

// MODIFIED: This function is now correctly typed and fetches notes with photos.
export async function handleAdminGetPhotosForUser(c: Context<AppEnv>): Promise<Response> {
    const { userId } = c.req.param();
    if (!userId) {
        return errorResponse("User ID parameter is required.", 400);
    }
    try {
        const query = `
            SELECT
                p.id, p.url, p.created_at, p.job_id, p.service_id, p.invoice_id,
                (SELECT JSON_GROUP_ARRAY(JSON_OBJECT('id', n.id, 'content', n.content, 'created_at', n.created_at))
                 FROM notes n WHERE n.photo_id = p.id) as notes
            FROM photos p
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
        `;

        // Define the raw result type from D1, where notes is a JSON string.
        type PhotoQueryResult = Omit<PhotoWithNotes, 'notes'> & { notes: string | null };

        const { results } = await c.env.DB.prepare(query).bind(userId).all<PhotoQueryResult>();

        // Map the raw results to the final, correctly typed PhotoWithNotes array.
        const photos: PhotoWithNotes[] = (results || []).map((p) => {
            // Parse the JSON string for notes and ensure it's a valid array of Note objects.
            const notesArray: Note[] = p.notes ? JSON.parse(p.notes) : [];
            const validNotes = notesArray.filter(note => note && note.id !== null);
            return {
                ...p,
                notes: validNotes,
            };
        });

        return successResponse(photos);
    } catch (e: any) {
        console.error(`Failed to get photos for user ${userId}:`, e);
        return errorResponse("Failed to retrieve photos for user.", 500);
    }
}


export async function handleAdminDeleteUser(c: Context<AppEnv>): Promise<Response> {
  const { userId } = c.req.param();
  if (!userId) {
    return errorResponse("User ID is required.", 400);
  }

  const db = c.env.DB;

  try {
    // D1 batches are transactional. If one statement fails, all are rolled back.
    const stmts = [
      // Delete all dependent records first
      db.prepare("DELETE FROM notes WHERE user_id = ?"),
      db.prepare("DELETE FROM photos WHERE user_id = ?"),
      db.prepare("DELETE FROM services WHERE user_id = ?"),
      db.prepare("DELETE FROM sms_messages WHERE user_id = ?"),
      db.prepare("DELETE FROM notifications WHERE user_id = ?"),
      db.prepare("DELETE FROM blocked_dates WHERE user_id = ?"),
      db.prepare("DELETE FROM jobs WHERE customerId = ?"),
      // Finally, delete the user. Records in tables with ON DELETE CASCADE
      // (calendar_tokens, password_reset_tokens) will be deleted automatically.
      db.prepare("DELETE FROM users WHERE id = ?"),
    ];

    // Bind the userId to all statements. Note that jobs.customerId is TEXT.
    const batch = stmts.map((stmt, index) =>
        index === 6 ? stmt.bind(userId) : stmt.bind(Number(userId))
    );

    await db.batch(batch);

    return successResponse({ message: `User ${userId} and all associated data deleted successfully.` });
  } catch (e: any) {
    console.error(`Failed to delete user ${userId}:`, e);
    return errorResponse("Failed to delete user. The user may have associated records that could not be deleted.", 500);
  }
}

export async function handleGetAllJobs(c: Context<AppEnv>): Promise<Response> {
    try {
        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM jobs ORDER BY start DESC`
        ).all<Job>();
        const jobs = dbResponse?.results || [];
        return successResponse(jobs);
    } catch (e: any) {
        console.error(`Failed to get all jobs:`, e);
        return errorResponse("Failed to retrieve all jobs.", 500);
    }
}

export async function handleGetAllServices(c: Context<AppEnv>): Promise<Response> {
    try {
        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM services ORDER BY service_date DESC`
        ).all<Service>();
        const services = dbResponse?.results || [];
        return successResponse(services);
    } catch (e: any) {
        console.error(`Failed to get all services:`, e);
        return errorResponse("Failed to retrieve all services.", 500);
    }
}

export async function handleAdminCreateInvoice(c: Context<AppEnv>): Promise<Response> {
  const { userId } = c.req.param();
  const db = c.env.DB;

  try {
    const user = await db.prepare(
      `SELECT id, name, email, phone, stripe_customer_id FROM users WHERE id = ?`
    ).bind(Number(userId)).first<User>();

    if (!user) {
      return errorResponse("User not found.", 404);
    }

    if (user.role === 'admin') {
      return errorResponse("Invoices cannot be created for admin users.", 400);
    }

    const stripe = getStripe(c.env as Env);
    let stripeCustomerId = user.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await createStripeCustomer(stripe, user);
      stripeCustomerId = customer.id;
      await db.prepare(
        `UPDATE users SET stripe_customer_id = ? WHERE id = ?`
      ).bind(stripeCustomerId, user.id).run();
    }

    if (!stripeCustomerId) {
        return errorResponse("Could not create or find Stripe customer.", 500);
    }

    const draftInvoice = await createDraftStripeInvoice(stripe, stripeCustomerId);

    if (!draftInvoice || !draftInvoice.id) {
        return errorResponse("Failed to create a valid draft invoice in Stripe.", 500);
    }

    const invoice = await stripe.invoices.retrieve(draftInvoice.id, {
        expand: ['lines'],
    });

    return successResponse({ invoice });
  } catch (e: any) {
    console.error(`Failed to create draft invoice for user ${userId}:`, e);
    return errorResponse(`Failed to create draft invoice: ${e.message}`, 500);
  }
}

export async function handleAdminCreateJobForUser(c: Context<AppEnv>): Promise<Response> {
  const { userId } = c.req.param();
  const body = await c.req.json();

  // Basic validation
  if (!body.title || !body.start || !body.price_cents) {
    return errorResponse("Job title, start date, and price are required.", 400);
  }

  try {
    // 1. Create the job using the existing helper
    const jobData = {
      title: body.title,
      description: `Created by admin on ${new Date().toLocaleDateString()}`,
      start: body.start,
      // Assume a 1-hour duration for simplicity
      end: new Date(new Date(body.start).getTime() + 60 * 60 * 1000).toISOString(),
      status: 'upcoming',
    };
    const newJob = await createJob(c.env, jobData, userId);

    // 2. Create the associated service which acts as a line item
    await c.env.DB.prepare(
      `INSERT INTO services (user_id, job_id, service_date, status, notes, price_cents)
       VALUES (?, ?, ?, 'pending', ?, ?)`
    ).bind(
      parseInt(userId, 10),
      newJob.id,
      newJob.start,
      body.title, // Use the job title as the service notes
      body.price_cents
    ).run();

    return successResponse(newJob, 201);
  } catch (e: any) {
    console.error(`Failed to create job for user ${userId}:`, e);
    return errorResponse("Failed to create job.", 500);
  }
}
