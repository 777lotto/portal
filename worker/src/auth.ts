// worker/src/auth.ts - Fixed imports and types
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Env } from "./env";

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
  if (!token) return false;

  try {
    const turnstileSecretKey = env.TURNSTILE_SECRET_KEY;

    const formData = new FormData();
    formData.append('secret', turnstileSecretKey);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const outcome = await result.json();
    return outcome.success === true;
  } catch (error) {
    console.error('Turnstile validation error:', error);
    return false;
  }
}

// Require authentication and return email
export async function requireAuth(request: Request, env: Env): Promise<string> {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("Missing token");

  try {
    const { payload } = await jwtVerify(
      auth.slice(7),
      getJwtSecretKey(env.JWT_SECRET)
    );

    if (!payload.email) {
      throw new Error("Invalid token payload");
    }

    return payload.email as string;
  } catch (error: any) {
    console.error("JWT Verification error:", error);
    if (error.code === 'ERR_JWS_INVALID') {
      throw new Error("Invalid token format");
    } else if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      throw new Error("Token signature verification failed");
    } else {
      throw new Error("Authentication failed");
    }
  }
}

// Create a new JWT token
export async function createJwtToken(
  payload: Record<string, any>, 
  secret: string, 
  expiresIn: string = "24h"
): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getJwtSecretKey(secret));
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
