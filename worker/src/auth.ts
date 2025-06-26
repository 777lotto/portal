// worker/src/auth.ts - CORRECTED

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Env, User } from "@portal/shared";
import type { AppEnv } from './index'; // This will be the new type definition from your main index.ts
import { Context, Next } from 'hono'; // Import Hono's official Context and Next types

// Helper to normalize email
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// Convert JWT secret to proper format
export function getJwtSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

// Validate Turnstile tokens
export async function validateTurnstileToken(token: string, ip: string, env: Env): Promise<boolean> {
  // This function's internal logic is correct.
  if (!token) return false;
  try {
    const turnstileSecretKey = env.TURNSTILE_SECRET_KEY;
    if (!turnstileSecretKey) {
      console.warn('⚠️  Turnstile secret key not configured');
      return false;
    }
    const formData = new FormData();
    formData.append('secret', turnstileSecretKey);
    formData.append('response', token);
    formData.append('remoteip', ip);
    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });
    const outcome = await result.json() as { success: boolean };
    return outcome.success === true;
  } catch (error) {
    console.error('Turnstile validation error:', error);
    return false;
  }
}

/**
 * Middleware for standard user authentication.
 */
export const requireAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
    const auth = c.req.header("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
        return c.json({ error: "Missing or invalid authorization header" }, 401);
    }
    const token = auth.slice(7).trim();
    if (!token) {
        return c.json({ error: "Invalid token format" }, 401);
    }
    try {
        if (!c.env.JWT_SECRET) {
            throw new Error("JWT_SECRET not configured");
        }
        const { payload } = await jwtVerify(token, getJwtSecretKey(c.env.JWT_SECRET));

        // The payload from the JWT is the User object. Set it on the context.
        c.set('user', payload as User);

        await next();
    } catch (error: any) {
        return c.json({ error: `Authentication failed: ${error.message}` }, 401);
    }
};

/**
 * Middleware for admin-only routes.
 */
export const requireAdminAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
    // First, run the standard auth middleware to set the user
    await requireAuthMiddleware(c, async () => {
        // This callback only runs if requireAuthMiddleware was successful
        const user = c.get('user');

        if (user && user.role === 'admin') {
            await next(); // User is an admin, proceed.
        } else {
            // Check if a response has already been set by the previous middleware
            if (!c.res.body) {
              return c.json({ error: 'Forbidden: Admin access required' }, 403);
            }
        }
    });
};

// Create JWT token with proper structure
export async function createJwtToken(user: User, secret: string, expiresIn: string = "7d"): Promise<string> {
    const jwt = new SignJWT({ ...user }) // Spread user properties into payload
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .setJti(crypto.randomUUID());

    return jwt.sign(getJwtSecretKey(secret));
}

// Hash password with bcrypt
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }
  return await bcrypt.hash(password, 10);
}

// Verify password against hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  return await bcrypt.compare(password, hash);
}
