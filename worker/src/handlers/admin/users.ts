// portal/worker/src/handlers/admin/users.ts

import { errorResponse, successResponse } from '../../utils.js';
import { Context } from 'hono';
import type { AppEnv } from '../../index.js';
import { getStripe, createStripeCustomer } from '../../stripe.js';
import { AdminCreateUserSchema, type User, type Job, type Photo, type Note } from '@portal/shared';

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

export async function handleAdminDeleteUser(c: Context<AppEnv>): Promise<Response> {
  const { user_id } = c.req.param();
  if (!user_id) {
    return errorResponse("User ID is required.", 400);
  }

  const db = c.env.DB;

  try {
    // First, get all job_ids for the user
    const jobIdsResult = await db.prepare("SELECT id FROM jobs WHERE user_id = ?").bind(Number(user_id)).all<{ id: string }>();
    const jobIds = jobIdsResult.results?.map(row => row.id) ?? [];

    const stmts = [];

    // Delete related data that has a direct user_id foreign key
    stmts.push(db.prepare("DELETE FROM notes WHERE user_id = ?").bind(Number(user_id)));
    stmts.push(db.prepare("DELETE FROM photos WHERE user_id = ?").bind(Number(user_id)));
    stmts.push(db.prepare("DELETE FROM notifications WHERE user_id = ?").bind(Number(user_id)));
    stmts.push(db.prepare("DELETE FROM calendar_events WHERE user_id = ?").bind(Number(user_id)));

    // Delete line_items for all jobs associated with the user
    if (jobIds.length > 0) {
      const placeholders = jobIds.map(() => '?').join(',');
      stmts.push(db.prepare(`DELETE FROM line_items WHERE job_id IN (${placeholders})`).bind(...jobIds));
    }

    // Now delete the jobs associated with the user
    stmts.push(db.prepare("DELETE FROM jobs WHERE user_id = ?").bind(Number(user_id)));

    // Finally, delete the user
    stmts.push(db.prepare("DELETE FROM users WHERE id = ?").bind(Number(user_id)));

    await db.batch(stmts);

    return successResponse({ message: `User ${user_id} and all their associated data deleted successfully.` });
  } catch (e: any) {
    console.error(`Failed to delete user ${user_id}:`, e);
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
    const { user_id } = c.req.param();
    const body = await c.req.json();
    const parsed = AdminCreateUserSchema.partial().safeParse(body);

    if (!parsed.success) {
        return errorResponse('Invalid user data', 400, parsed.error.flatten());
    }

    let { name, company_name, email, phone, address, role } = parsed.data;
    const db = c.env.DB;

    try {
        const existingUser = await db.prepare(`SELECT * FROM users WHERE id = ?`).bind(user_id).first<User>();
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
            user_id
        ).first<User>();

        return successResponse(updatedResult);

    } catch (e: any) {
        if (e.message?.includes('UNIQUE constraint failed')) {
            return errorResponse('A user with this email or phone number already exists.', 409);
        }
        console.error(`Failed to update user ${user_id}:`, e);
        return errorResponse('Failed to update user.', 500);
    }
}

export async function handleAdminGetJobsForUser(c: Context<AppEnv>): Promise<Response> {
    const { user_id } = c.req.param();
    try {
        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE user_id = ? ORDER BY createdAt DESC`
        ).bind(Number(user_id)).all<Job>();
        const jobs = dbResponse?.results || [];
        return successResponse(jobs);
    } catch (e: any) {
        console.error(`Failed to get jobs for user ${user_id}:`, e);
        return errorResponse("Failed to retrieve jobs for user.", 500);
    }
}

export async function handleAdminGetPhotosForUser(c: Context<AppEnv>): Promise<Response> {
    const { user_id } = c.req.param();
    try {
        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM photos WHERE user_id = ? ORDER BY created_at DESC`
        ).bind(Number(user_id)).all<Photo>();
        const photos = dbResponse?.results || [];
        return successResponse(photos);
    } catch (e: any) {
        console.error(`Failed to get photos for user ${user_id}:`, e);
        return errorResponse("Failed to retrieve photos for user.", 500);
    }
}

export async function handleAdminGetNotesForUser(c: Context<AppEnv>): Promise<Response> {
    const { user_id } = c.req.param();
    try {
        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC`
        ).bind(Number(user_id)).all<Note>();
        const notes = dbResponse?.results || [];
        return successResponse(notes);
    } catch (e: any) {
        console.error(`Failed to get notes for user ${user_id}:`, e);
        return errorResponse("Failed to retrieve notes for user.", 500);
    }
}
