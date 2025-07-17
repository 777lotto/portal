// worker/src/auth.ts - UPDATED

import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { Context, Next } from 'hono';
import type { AppEnv } from './index.js';
import type { Env, User } from "@portal/shared";

export function getJwtSecretKey(secret: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(secret);
}

// This middleware requires a valid JWT to proceed
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
        return await next();
    } catch (error) {
        console.error("Auth failed:", error);
        return c.json({ error: 'Authentication failed: Invalid token' }, 401);
    }
};

// This middleware assumes requireAuthMiddleware has already run
// and simply checks if the user has the 'admin' role.
export const requireAdminAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
    const user = c.get('user');
    if (user && user.role === 'admin') {
        return await next();
    } else {
        return c.json({ error: 'Forbidden: Admin access required' }, 403);
    }
};

// NEW: Middleware specifically for chat authorization
export const requireChatAuthMiddleware = async (c: Context<AppEnv>, next: Next) => {
    const user = c.get('user'); // Assumes requireAuthMiddleware has run
    if (user && (user.role === 'admin' || user.role === 'associate')) {
        return await next(); // User is admin or associate, proceed.
    } else {
        return c.json({ error: 'Forbidden: You do not have permission to access chat.' }, 403);
    }
};


// --- The rest of the file remains the same ---

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

export const requirePasswordSetTokenMiddleware = async (c: Context<AppEnv>, next: Next) => {
    const authHeader = c.req.header("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Missing or invalid authorization header" }, 401);
    }
    const token = authHeader.substring(7);

    try {
        const secret = getJwtSecretKey(c.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);

        if (payload.purpose !== 'password-set' || !payload.sub) {
             return c.json({ error: 'Forbidden: Invalid token type' }, 403);
        }
        c.set('user', { id: Number(payload.sub) } as User);
        return await next();

    } catch (error) {
        return c.json({ error: 'Authentication failed: Invalid token' }, 401);
    }
};
