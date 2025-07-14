// 777lotto/portal/portal-bet/worker/src/handlers/admin/users.ts

import { errorResponse, successResponse } from '../../utils.js';
import { Context } from 'hono';
import type { AppEnv } from '../../index.js';
import type { User, Job, Photo } from '@portal/shared';

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
    try {
        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM photos WHERE user_id = ? ORDER BY created_at DESC`
        ).bind(userId).all<Photo>();
        const photos = dbResponse?.results || [];
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
