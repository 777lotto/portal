// worker/src/auth.ts - Fixed JWT implementation
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Env } from "@portal/shared";

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

    const outcome = await result.json() as { success: boolean };
    return outcome.success === true;
  } catch (error) {
    console.error('Turnstile validation error:', error);
    return false;
  }
}

// FIXED: More robust auth function
export async function requireAuth(request: Request, env: Env): Promise<string> {
  const auth = request.headers.get("Authorization") || "";
  
  if (!auth.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }

  const token = auth.slice(7);
  
  if (!token || token.length < 10) {
    throw new Error("Invalid token format");
  }

  try {
    const { payload } = await jwtVerify(
      token,
      getJwtSecretKey(env.JWT_SECRET),
      {
        algorithms: ['HS256']
      }
    );

    // FIXED: Better payload validation
    if (!payload.email && !payload.phone) {
      throw new Error("Invalid token payload - missing user identifier");
    }

    // FIXED: Ensure we return the email for user identification
    const identifier = payload.email as string;
    if (!identifier) {
      throw new Error("Token missing email");
    }
    
    return identifier;
  } catch (error: any) {
    console.error("JWT Verification error:", error);
    
    // FIXED: More specific error handling
    if (error.code === 'ERR_JWT_EXPIRED') {
      throw new Error("Token has expired - please log in again");
    } else if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      throw new Error("Invalid token signature");
    } else {
      throw new Error("Authentication failed");
    }
  }
}

// FIXED: More reliable JWT creation
export async function createJwtToken(
  payload: Record<string, any>, 
  secret: string, 
  expiresIn: string = "7d"
): Promise<string> {
  try {
    // FIXED: Ensure payload has required fields
    const cleanPayload = {
      id: Number(payload.id),
      email: payload.email || null,
      name: payload.name || '',
      phone: payload.phone || null,
      iat: Math.floor(Date.now() / 1000)
    };

    const jwt = new SignJWT(cleanPayload)
      .setProtectedHeader({ 
        alg: "HS256", 
        typ: "JWT" 
      })
      .setIssuedAt()
      .setExpirationTime(expiresIn);

    const token = await jwt.sign(getJwtSecretKey(secret));
    
    // FIXED: Validate the created token immediately
    try {
      await jwtVerify(token, getJwtSecretKey(secret));
    } catch (testError) {
      console.error('Created JWT is invalid:', testError);
      throw new Error('Failed to create valid JWT token');
    }
    
    return token;
  } catch (error: any) {
    console.error('JWT creation error:', error);
    throw new Error(`Failed to create authentication token: ${error.message}`);
  }
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
