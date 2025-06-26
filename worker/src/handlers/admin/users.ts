// worker/src/handlers/admin/users.ts - CORRECTED

import { errorResponse } from '../../utils';
// FIX: Import Context from Hono and AppEnv from index.ts
import { Context } from 'hono';
import type { AppEnv } from '../../index';

export async function handleGetAllUsers(c: Context<AppEnv>): Promise<Response> {
  const env = c.env;
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, email, name, phone, role, stripe_customer_id FROM users ORDER BY name ASC`
    ).all<User[]>(); // Use the User type from your shared package
    return c.json(results || []);
  } catch (e: any) {
    console.error("Error fetching all users:", e);
    return errorResponse('Failed to fetch users.', 500);
  }
}
