// 777lotto/portal/portal-bet/worker/src/handlers/admin/users.ts

import { errorResponse, successResponse } from '../../utils.js';
import { Context } from 'hono';
import type { AppEnv } from '../../index.js';
import { getStripe, createStripeCustomer, createDraftStripeInvoice } from '../../stripe.js';
import { createJob } from '../../calendar.js'
// MODIFIED: 'AdminCreateUserSchema' is now a value import, and the others are explicit type imports.
import { AdminCreateUserSchema, type User, type Job, type Service, type Env, type Note, type PhotoWithNotes } from '@portal/shared';

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

        type PhotoQueryResult = Omit<PhotoWithNotes, 'notes'> & { notes: string | null };

        const { results } = await c.env.DB.prepare(query).bind(userId).all<PhotoQueryResult>();

        const photos: PhotoWithNotes[] = (results || []).map((p) => {
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
    const stmts = [
      db.prepare("DELETE FROM notes WHERE user_id = ?"),
      db.prepare("DELETE FROM photos WHERE user_id = ?"),
      db.prepare("DELETE FROM services WHERE user_id = ?"),
      db.prepare("DELETE FROM sms_messages WHERE user_id = ?"),
      db.prepare("DELETE FROM notifications WHERE user_id = ?"),
      db.prepare("DELETE FROM blocked_dates WHERE user_id = ?"),
      db.prepare("DELETE FROM jobs WHERE customerId = ?"),
      db.prepare("DELETE FROM users WHERE id = ?"),
    ];

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

export async function handleAdminCreateUser(c: Context<AppEnv>): Promise<Response> {
    const body = await c.req.json();
    const parsed = AdminCreateUserSchema.safeParse(body);

    if (!parsed.success) {
        return errorResponse('Invalid user data', 400, parsed.error.flatten());
    }

    const { name, company_name, email, phone, address, role } = parsed.data;
    const db = c.env.DB;

    try {
        if (!email && !phone) {
            return errorResponse("An email or phone number is required to create a user.", 400);
        }

        const lowercasedEmail = email?.toLowerCase();
        const cleanedPhone = phone?.replace(/\D/g, '');

        const { results } = await db.prepare(
            `INSERT INTO users (name, company_name, email, phone, address, role) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
            name || null,
            company_name || null,
            lowercasedEmail || null,
            cleanedPhone || null,
            address || null,
            role
        ).all<User>();

        const newUser = results[0];

        if (newUser.email && newUser.role !== 'admin' && newUser.role !== 'associate') {
            const stripe = getStripe(c.env);
            const customer = await createStripeCustomer(stripe, newUser);
            await db.prepare(
                `UPDATE users SET stripe_customer_id = ? WHERE id = ?`
            ).bind(customer.id, newUser.id).run();
            newUser.stripe_customer_id = customer.id;
        }

        return successResponse(newUser, 201);
    } catch (e: any) {
        if (e.message?.includes('UNIQUE constraint failed')) {
            return errorResponse('A user with this email or phone number already exists.', 409);
        }
        console.error(`Failed to create user by admin:`, e);
        return errorResponse('Failed to create user.', 500);
    }
}

export async function handleAdminUpdateUser(c: Context<AppEnv>): Promise<Response> {
    const { userId } = c.req.param();
    const body = await c.req.json();
    const parsed = AdminCreateUserSchema.partial().safeParse(body);

    if (!parsed.success) {
        return errorResponse('Invalid user data', 400, parsed.error.flatten());
    }

    const { name, company_name, email, phone, address, role } = parsed.data;
    const db = c.env.DB;

    try {
        const existingUser = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first<User>();
        if (!existingUser) {
            return errorResponse("User not found", 404);
        }

        const lowercasedEmail = email?.toLowerCase();
        const cleanedPhone = phone?.replace(/\D/g, '');

        const updatedResult = await db.prepare(
            `UPDATE users SET name = ?, company_name = ?, email = ?, phone = ?, address = ?, role = ? WHERE id = ? RETURNING *`
        ).bind(
            name ?? existingUser.name,
            company_name ?? existingUser.company_name,
            lowercasedEmail ?? existingUser.email,
            cleanedPhone ?? existingUser.phone,
            address ?? existingUser.address,
            role ?? existingUser.role,
            userId
        ).first<User>();

        return successResponse(updatedResult);

    } catch (e: any) {
        if (e.message?.includes('UNIQUE constraint failed')) {
            return errorResponse('A user with this email or phone number already exists.', 409);
        }
        console.error(`Failed to update user ${userId}:`, e);
        return errorResponse('Failed to update user.', 500);
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
      `SELECT id, name, email, phone, stripe_customer_id, role FROM users WHERE id = ?`
    ).bind(Number(userId)).first<User>();

    if (!user) {
      return errorResponse("User not found.", 404);
    }

    if (user.role === 'admin' || user.role === 'associate') {
      return errorResponse("Invoices cannot be created for admin or associate users.", 400);
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

  if (!body.title || !body.start || !Array.isArray(body.services) || body.services.length === 0) {
    return errorResponse("Job title, start date, and at least one service are required.", 400);
  }

  try {
    const jobData = {
      title: body.title,
      description: `Created by admin on ${new Date().toLocaleDateString()}`,
      start: body.start,
      end: new Date(new Date(body.start).getTime() + 60 * 60 * 1000).toISOString(),
      status: 'upcoming',
    };
    const newJob = await createJob(c.env, jobData, userId);

    const serviceInserts = body.services.map((service: { notes: string, price_cents: number }) => {
      return c.env.DB.prepare(
        `INSERT INTO services (user_id, job_id, service_date, status, notes, price_cents)
         VALUES (?, ?, ?, 'pending', ?, ?)`
      ).bind(
        parseInt(userId, 10),
        newJob.id,
        newJob.start,
        service.notes,
        service.price_cents
      );
    });

    await c.env.DB.batch(serviceInserts);

    return successResponse(newJob, 201);
  } catch (e: any) {
    console.error(`Failed to create job for user ${userId}:`, e);
    return errorResponse("Failed to create job.", 500);
  }
}
