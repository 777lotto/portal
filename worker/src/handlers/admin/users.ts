// worker/src/handlers/admin/users.ts - CORRECTED
import { errorResponse } from '../../utils';
import { Context } from 'hono';
import type { AppEnv } from '../../index';
import type { User } from '@portal/shared'; // FIX: Import User type

export async function handleGetAllUsers(c: Context<AppEnv>): Promise<Response> {
  const env = c.env;
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, email, name, phone, role, stripe_customer_id FROM users ORDER BY name ASC`
    ).all<User[]>();
    return c.json(results || []);
  } catch (e: any) {
    console.error("Error fetching all users:", e);
    return errorResponse('Failed to fetch users.', 500);
  }
}
