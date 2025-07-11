// 777lotto/portal/portal-bet/worker/src/handlers/admin/users.ts

import { errorResponse, successResponse } from '../../utils.js';
import { Context } from 'hono';
import type { AppEnv } from '../../index.js';
import type { User, Job } from '@portal/shared';

export async function handleGetAllUsers(c: Context<AppEnv>): Promise<Response> {
  const env = c.env;
  try {
    // .all() returns an object like { results: T[], ... }
    // The generic should be for a single row, not an array.
    const dbResponse = await env.DB.prepare(
      `SELECT id, email, name, phone, role, stripe_customer_id, company_name FROM users ORDER BY name ASC`
    ).all<User>();

    // Defensively access the 'results' property and default to an empty array
    // if it's null, undefined, or doesn't exist.
    const users = dbResponse?.results || [];

    return successResponse(users);
  } catch (e: any)
{
    console.error("Error fetching all users:", e);
    return errorResponse('Failed to fetch users.', 500);
  }
}

export async function handleAdminGetJobsForUser(c: Context<AppEnv>): Promise<Response> {
    const { userId } = c.req.param();
    try {
        // Apply the same defensive pattern here
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
