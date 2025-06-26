// worker/src/handlers/auth.ts - CORRECTED

import { createJwtToken, normalizeEmail, hashPassword, validateTurnstileToken, verifyPassword } from '../auth';
import { getOrCreateCustomer } from '../stripe';
import { errorResponse } from '../utils';
import type { AppContext } from '../index';
import type { User } from '@portal/shared';

export async function handleSignup(c: AppContext): Promise<Response> {
  const env = c.env;
  try {
    const { email, name, password, phone, turnstileToken } = await c.req.json();

    if (!email || !name || !password || !phone) {
      return errorResponse("Missing required fields", 400);
    }

    const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
    if (!await validateTurnstileToken(turnstileToken, ip, env)) {
      return errorResponse("Invalid security token.", 403);
    }

    const normalizedEmail = normalizeEmail(email);
    const passwordHash = await hashPassword(password);

    const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(normalizedEmail).first();
    if (existingUser) {
      return errorResponse("A user with this email already exists", 409);
    }

    // NOTE: Make sure getOrCreateCustomer is defined in your stripe.ts
    const stripeCustomer = await getOrCreateCustomer({ email: normalizedEmail, name, phone }, env);

    const { results } = await env.DB.prepare(
      "INSERT INTO users (email, name, password_hash, phone, stripe_customer_id) VALUES (?, ?, ?, ?, ?) RETURNING id, email, name, phone, role"
    ).bind(normalizedEmail, name, passwordHash, phone, stripeCustomer.id).run();

    const userResult = results[0] as User;
    const token = await createJwtToken(userResult, env.JWT_SECRET);

    return c.json({ user: userResult, token });

  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function handleLogin(c: AppContext): Promise<Response> {
  const env = c.env;
  try {
    const { identifier, password, turnstileToken } = await c.req.json();

    const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
    if (!await validateTurnstileToken(turnstileToken, ip, env)) {
      return errorResponse("Invalid security token.", 403);
    }

    const user = await env.DB.prepare(
      "SELECT id, email, name, password_hash, phone, role, stripe_customer_id FROM users WHERE email = ? OR phone = ?"
    ).bind(identifier, identifier).first<User & { password_hash: string }>();

    if (!user || !user.password_hash) {
      return errorResponse("Invalid credentials", 401);
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return errorResponse("Invalid credentials", 401);
    }

    const { password_hash, ...userPayload } = user;
    const token = await createJwtToken(userPayload, env.JWT_SECRET);

    return c.json({ user: userPayload, token });

  } catch (e: any) {
    return errorResponse(e.message, 500);
  }
}

export async function handleRequestPasswordReset(c: AppContext): Promise<Response> {
    // In a real app, this would generate and store a reset token and send an email.
    const { email } = await c.req.json();
    console.log(`Password reset requested for: ${email}`);
    return c.json({ message: "If an account with this email exists, a password reset link has been sent." });
}

