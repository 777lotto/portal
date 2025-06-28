// worker/src/auth.ts - CORRECTED
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { Context, Next } from 'hono';
import type { AppEnv } from './index';
import type { Env, User } from "@portal/shared";

export function getJwtSecretKey(secret: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(secret);
}

// FIX: Removed explicit return type to align with Hono's middleware pattern.
export const requireAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
    const authHeader = c.req.header("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Missing or invalid authorization header" }, 401);
    }
    const token = authHeader.substring(7);
    if (!token) {
        return c.json({ error: "Invalid token format" }, 401);
    }
    try {
        if (!c.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not configured in the environment.");
        }
        const secret = getJwtSecretKey(c.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        c.set('user', payload as User);
        await next();
    } catch (error) {
        console.error("Auth failed:", error);
        return c.json({ error: 'Authentication failed: Invalid token' }, 401);
    }
};

// FIX: Removed explicit return type to align with Hono's middleware pattern.
export const requireAdminAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
    const authResponse = await requireAuthMiddleware(c, async () => {}).catch(() => {});
    if (authResponse) {
        return authResponse;
    }

    const user = c.get('user');
    if (user && user.role === 'admin') {
        await next();
    } else {
        return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }
};

export async function createJwtToken(user: User, secret: string, expiresIn: string = "7d"): Promise<string> {
    const jwt = new SignJWT({ ...user })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .setJti(crypto.randomUUID());

    return jwt.sign(getJwtSecretKey(secret));
}

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  return await bcrypt.compare(password, hash);
}

export async function validateTurnstileToken(token: string, ip: string, env: Env): Promise<boolean> {
  if (!token) return false;
  try {
    const turnstileSecretKey = env.TURNSTILE_SECRET_KEY;
    if (!turnstileSecretKey) {
      console.warn('⚠️ Turnstile secret key not configured');
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
