// worker/src/handlers/profile.ts - CORRECTED

import { errorResponse } from '../utils';
import type { AppContext } from '../index';
import type { User } from '@portal/shared';

export async function handleGetProfile(c: AppContext): Promise<Response> {
  const user = c.get('user'); // From requireAuthMiddleware
  const env = c.env;
  try {
    const profile = await env.DB.prepare(
      "SELECT id, email, name, phone, stripe_customer_id, role FROM users WHERE id = ?"
    ).bind(user.id).first();

    if (!profile) {
      return errorResponse("Profile not found", 404);
    }
    return c.json(profile);
  } catch (e: any) {
    console.error("Error getting profile:", e);
    return errorResponse(e.message, 500);
  }
}

export async function handleUpdateProfile(c: AppContext): Promise<Response> {
  const user = c.get('user'); // From requireAuthMiddleware
  const env = c.env;
  try {
    const { name, phone } = await c.req.json();

    if (!name && !phone) {
      return errorResponse("Name or phone must be provided", 400);
    }

    const currentUserState = await env.DB.prepare("SELECT name, phone FROM users WHERE id = ?").bind(user.id).first<{name: string, phone: string}>();

    await env.DB.prepare(
      "UPDATE users SET name = ?, phone = ? WHERE id = ?"
    ).bind(
      name || currentUserState?.name,
      phone || currentUserState?.phone,
      user.id
    ).run();

    return new Response(null, { status: 204 }); // Success, No Content
  } catch (e: any) {
    console.error("Error updating profile:", e);
    return errorResponse(e.message, 500);
  }
}
