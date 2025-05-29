// worker/src/auth.ts - Fixed JWT handling with better error messages
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

// Require authentication and return email - FIXED
export async function requireAuth(request: Request, env: Env): Promise<string> {
  const auth = request.headers.get("Authorization") || "";
  console.log('🔍 Auth header received:', auth ? `Bearer ${auth.slice(7, 20)}...` : 'none');
  
  if (!auth.startsWith("Bearer ")) {
    console.error('❌ Missing or invalid Authorization header format');
    throw new Error("Missing or invalid authorization header");
  }

  const token = auth.slice(7); // Remove "Bearer " prefix
  console.log('🎫 Token extracted, length:', token.length);

  if (!token || token.length < 10) {
    console.error('❌ Token too short or empty');
    throw new Error("Invalid token format");
  }

  try {
    console.log('🔓 Verifying JWT token...');
    
    const { payload } = await jwtVerify(
      token,
      getJwtSecretKey(env.JWT_SECRET)
    );

    console.log('✅ JWT payload verified:', {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      iat: payload.iat,
      exp: payload.exp
    });

    // Ensure we have an email or phone to identify the user
    if (!payload.email && !payload.phone) {
      console.error('❌ Token payload missing user identifier');
      throw new Error("Invalid token payload - missing user identifier");
    }

    // Return email if available, otherwise use phone as fallback identifier
    const identifier = payload.email as string || payload.phone as string;
    console.log('✅ User authenticated:', identifier);
    
    return identifier;
  } catch (error: any) {
    console.error("❌ JWT Verification error:", error);
    
    // Provide more specific error messages
    if (error.code === 'ERR_JWS_INVALID') {
      throw new Error("Invalid token format");
    } else if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      throw new Error("Token signature verification failed");
    } else if (error.code === 'ERR_JWT_EXPIRED') {
      throw new Error("Token has expired - please log in again");
    } else if (error.name === 'JWTExpired') {
      throw new Error("Token has expired - please log in again");
    } else {
      console.error("Detailed JWT error:", {
        name: error.name,
        code: error.code,
        message: error.message
      });
      throw new Error("Authentication failed");
    }
  }
}

// Create a new JWT token - FIXED
export async function createJwtToken(
  payload: Record<string, any>, 
  secret: string, 
  expiresIn: string = "7d"
): Promise<string> {
  try {
    console.log('🔐 Creating JWT with payload:', payload);
    
    // Ensure payload has required fields and proper types
    const cleanPayload = {
      ...payload,
      id: Number(payload.id), // Ensure ID is a number
      iat: Math.floor(Date.now() / 1000) // Current timestamp
    };

    console.log('🔐 Clean payload for JWT:', cleanPayload);

    const jwt = new SignJWT(cleanPayload)
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(expiresIn);

    const token = await jwt.sign(getJwtSecretKey(secret));
    
    console.log('✅ JWT created successfully, length:', token.length);
    
    // Validate the token we just created by parsing it
    try {
      const testVerify = await jwtVerify(token, getJwtSecretKey(secret));
      console.log('✅ JWT validation test passed:', {
        id: testVerify.payload.id,
        email: testVerify.payload.email,
        exp: testVerify.payload.exp
      });
    } catch (testError) {
      console.error('❌ JWT validation test failed:', testError);
      throw new Error('Created JWT token is invalid');
    }
    
    return token;
  } catch (error: any) {
    console.error('❌ JWT creation error:', error);
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
