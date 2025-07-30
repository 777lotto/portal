// 777lotto/portal/portal-bet/worker/src/handlers/admin/users.ts

import { errorResponse, successResponse } from '../../utils.js';
import { Context } from 'hono';
import type { AppEnv } from '../../index.js';
import { getStripe, createStripeCustomer, createDraftStripeInvoice } from '../../stripe.js';
import { createJob } from '../../calendar.js'
import { AdminCreateUserSchema, type User, type Job, type Env, type Note, type PhotoWithNotes, type JobStatus } from '@portal/shared';

/**
 * Validates an address using the Google Geocoding API.
 * @param address The address string to validate.
 * @param env The worker environment containing the API key.
 * @returns A formatted address string if valid, null if invalid, or the original address on API error.
 */
async function getValidatedAddress(address: string, env: AppEnv['Bindings']): Promise<string | null> {
  const GOOGLE_API_KEY = env.GOOGLE_API_KEY;
  if (!GOOGLE_API_KEY) {
    console.error("GOOGLE_API_KEY is not configured. Skipping address validation.");
    return address; // Fallback to the original address if the key is missing
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;

  try {
    const response = await fetch(url);
    const data: any = await response.json();

    if (data.status === 'OK' && data.results[0]) {
      // Return the nicely formatted address from Google
      return data.results[0].formatted_address;
    }
    // Return null if the address is not found or invalid
    return null;
  } catch (e) {
    console.error("Address validation API call failed:", e);
    // Fallback to the original address on a network error
    return address;
  }
}

export async function handleGetAllUsers(c: Context<AppEnv>): Promise<Response> {
  const env = c.env;
  try {
    const dbResponse = await env.DB.prepare(
      `SELECT id, email, name, phone, role, stripe_customer_id, company_name, address FROM users ORDER BY name ASC`
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
            `SELECT * FROM jobs WHERE user_id = ? ORDER BY createdAt DESC`
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
                p.id, p.url, p.createdAt, p.job_id,
                (SELECT JSON_GROUP_ARRAY(JSON_OBJECT('id', n.id, 'content', n.content, 'createdAt', n.createdAt))
                 FROM notes n WHERE n.photo_id = p.id) as notes
            FROM photos p
            WHERE p.user_id = ?
            ORDER BY p.createdAt DESC
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
    // First, get all job_ids for the user
    const jobIdsResult = await db.prepare("SELECT id FROM jobs WHERE user_id = ?").bind(Number(userId)).all<{ id: string }>();
    const jobIds = jobIdsResult.results?.map(row => row.id) ?? [];

    const stmts = [];

    // Delete related data that has a direct user_id foreign key
    stmts.push(db.prepare("DELETE FROM notes WHERE user_id = ?").bind(Number(userId)));
    stmts.push(db.prepare("DELETE FROM photos WHERE user_id = ?").bind(Number(userId)));
    stmts.push(db.prepare("DELETE FROM notifications WHERE user_id = ?").bind(Number(userId)));
    stmts.push(db.prepare("DELETE FROM calendar_events WHERE user_id = ?").bind(Number(userId)));

    // Delete line_items for all jobs associated with the user
    if (jobIds.length > 0) {
      const placeholders = jobIds.map(() => '?').join(',');
      stmts.push(db.prepare(`DELETE FROM line_items WHERE job_id IN (${placeholders})`).bind(...jobIds));
    }

    // Now delete the jobs associated with the user
    stmts.push(db.prepare("DELETE FROM jobs WHERE user_id = ?").bind(Number(userId)));
    
    // Finally, delete the user
    stmts.push(db.prepare("DELETE FROM users WHERE id = ?").bind(Number(userId)));

    await db.batch(stmts);

    return successResponse({ message: `User ${userId} and all their associated data deleted successfully.` });
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

    let { name, company_name, email, phone, address, role } = parsed.data;
    const db = c.env.DB;

    try {
        if (!email && !phone) {
            return errorResponse("An email or phone number is required to create a user.", 400);
        }

        // Validate the address if one was provided
        if (address) {
            const validatedAddress = await getValidatedAddress(address, c.env);
            if (validatedAddress) {
                address = validatedAddress; // Use the validated and formatted address
            } else {
                return errorResponse("The provided service address could not be validated. Please check it and try again.", 400);
            }
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
            address || null, // Save the validated address
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

    let { name, company_name, email, phone, address, role } = parsed.data;
    const db = c.env.DB;

    try {
        const existingUser = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first<User>();
        if (!existingUser) {
            return errorResponse("User not found", 404);
        }

        // Validate the address if a new one was provided
        if (address && address !== existingUser.address) {
            const validatedAddress = await getValidatedAddress(address, c.env);
            if (validatedAddress) {
                address = validatedAddress; // Use the validated and formatted address
            } else {
                return errorResponse("The provided service address could not be validated. Please check it and try again.", 400);
            }
        }

        const lowercasedEmail = email?.toLowerCase();
        const cleanedPhone = phone?.replace(/\D/g, '');

        const updatedResult = await db.prepare(
            `UPDATE users SET name = ?, company_name = ?, email = ?, phone = ?, address = ?, role = ? WHERE id = ? RETURNING *`
        ).bind(
            name ?? existingUser.name,
            company_name !== undefined ? (company_name || null) : existingUser.company_name,
            lowercasedEmail ?? existingUser.email,
            cleanedPhone ?? existingUser.phone,
            address !== undefined ? (address || null) : existingUser.address, // Save the validated address
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
            `SELECT * FROM jobs ORDER BY createdAt ASC`
        ).all<Job>();
        const jobs = dbResponse?.results || [];
        return successResponse(jobs);
    } catch (e: any) {
        console.error(`Failed to get all jobs:`, e);
        return errorResponse("Failed to retrieve all jobs.", 500);
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
    let stripeuser_id = user.stripe_customer_id;

    if (!stripeuser_id) {
      const customer = await createStripeCustomer(stripe, user);
      stripeuser_id = customer.id;
      await db.prepare(
        `UPDATE users SET stripe_customer_id = ? WHERE id = ?`
      ).bind(stripeuser_id, user.id).run();
    }

    if (!stripeuser_id) {
        return errorResponse("Could not create or find Stripe customer.", 500);
    }

    const draftInvoice = await createDraftStripeInvoice(stripe, stripeuser_id);

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
  const { title, lineItems, days_until_expiry, jobType, action } = body;

  if (!title || !Array.isArray(lineItems) || lineItems.length === 0) {
    return errorResponse("Job title and at least one line item are required.", 400);
  }

  try {
    const due = new Date();
    due.setDate(due.getDate() + (days_until_expiry || 7));

    let status: JobStatus;
    switch (jobType) {
      case 'quote':
        if (action === 'draft') status = 'quote_draft';
        else if (action === 'send_proposal') status = 'pending';
        else status = 'pending'; // Default for quote
        break;
      case 'job':
        if (action === 'post') status = 'upcoming';
        else if (action === 'draft') status = 'job_draft';
        else status = 'upcoming'; // Default for job
        break;
      case 'invoice':
        if (action === 'draft') status = 'invoice_draft';
        else if (action === 'send_invoice') status = 'payment_needed';
        else status = 'payment_needed'; // Default for invoice
        break;
      default:
        status = 'upcoming';
    }

    const jobData = {
      title: title,
      description: `Created by admin on ${new Date().toLocaleDateString()}`,
      status: status,
      recurrence: 'none',
      due: due.toISOString(),
    };
    const newJob = await createJob(c.env, jobData, parseInt(userId, 10));

    const lineItemInserts = lineItems.map((item: { description: string, quantity: number, unit_total_amount_cents: number }) => {
      return c.env.DB.prepare(
        `INSERT INTO line_items (job_id, description, quantity, unit_total_amount_cents)
         VALUES (?, ?, ?, ?)`
      ).bind(
        newJob.id,
        item.description,
        item.quantity,
        item.unit_total_amount_cents
      );
    });

    await c.env.DB.batch(lineItemInserts);

    if (jobType === 'quote' && action === 'send_proposal') {
      const notificationMessage = `You have a new quote proposal for "${title}".`;
      await c.env.DB.prepare(
        `INSERT INTO notifications (user_id, type, message, link)
         VALUES (?, 'new_quote', ?, ?)`
      ).bind(
        parseInt(userId, 10),
        notificationMessage,
        `/quotes/${newJob.id}`
      ).run();
    }

    if (jobType === 'invoice' && action === 'send_invoice') {
      const user = await c.env.DB.prepare(
        `SELECT id, name, email, phone, stripe_customer_id, role FROM users WHERE id = ?`
      ).bind(parseInt(userId, 10)).first<User>();

      if (!user) {
        return errorResponse("User not found.", 404);
      }

      const stripe = getStripe(c.env as Env);
      let stripeuser_id = user.stripe_customer_id;

      if (!stripeuser_id) {
        const customer = await createStripeCustomer(stripe, user);
        stripeuser_id = customer.id;
        await c.env.DB.prepare(
          `UPDATE users SET stripe_customer_id = ? WHERE id = ?`
        ).bind(stripeuser_id, user.id).run();
      }

      if (!stripeuser_id) {
          return errorResponse("Could not create or find Stripe customer.", 500);
      }

      const draftInvoice = await createDraftStripeInvoice(stripe, stripeuser_id);

      if (!draftInvoice || !draftInvoice.id) {
          return errorResponse("Failed to create a valid draft invoice in Stripe.", 500);
      }

      for (const item of lineItems) {
        await stripe.invoiceItems.create({
          customer: stripeuser_id,
          invoice: draftInvoice.id,
          description: item.description,
          quantity: item.quantity,
          amount: item.unit_total_amount_cents,
          currency: 'usd',
        });
      }

      const finalInvoice = await stripe.invoices.sendInvoice(draftInvoice.id);
      await c.env.DB.prepare(
        `UPDATE jobs SET stripe_invoice_id = ? WHERE id = ?`
      ).bind(finalInvoice.id, newJob.id).run();
    }

    return successResponse(newJob, 201);
  } catch (e: any) {
    console.error(`Failed to create job for user ${userId}:`, e);
    return errorResponse("Failed to create job.", 500);
  }
}

