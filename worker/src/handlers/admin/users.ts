// worker/src/handlers/admin/users.ts - CORRECTED
import { errorResponse, successResponse } from '../../utils.js';
import { Context } from 'hono';
import type { AppEnv } from '../../index.js';
import type { User, Job } from '@portal/shared';

export async function handleGetAllUsers(c: Context<AppEnv>): Promise<Response> {
  const env = c.env;
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, email, name, phone, role, stripe_customer_id, company_name FROM users ORDER BY name ASC`
    ).all<User[]>();
    return successResponse(results || []);
  } catch (e: any) {
    console.error("Error fetching all users:", e);
    return errorResponse('Failed to fetch users.', 500);
  }
}

export async function handleAdminGetJobsForUser(c: Context<AppEnv>): Promise<Response> {
    const { userId } = c.req.param();
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM jobs WHERE customerId = ? ORDER BY start DESC`
        ).bind(userId).all<Job>();
        return successResponse(results || []);
    } catch (e: any) {
        console.error(`Failed to get jobs for user ${userId}:`, e);
        return errorResponse("Failed to retrieve jobs for user.", 500);
    }
}
