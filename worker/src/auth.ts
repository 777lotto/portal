// worker/src/auth.ts - Fixed JWT implementation with proper error handling
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

    const outcome = await result.json() as { success: boolean; 'error-codes'?: string[] };
    
    if (!outcome.success && outcome['error-codes']) {
      console.error('Turnstile validation failed:', outcome['error-codes']);
    }
    
    return outcome.success === true;
  } catch (error) {
    console.error('Turnstile validation error:', error);
    return false;
  }
}

// Auth middleware - extracts and validates JWT token
export async function requireAuth(request: Request, env: Env): Promise<string> {
  const auth = request.headers.get("Authorization") || "";
  
  // Log auth header for debugging
  console.log('🔐 Auth header:', auth ? `Bearer ${auth.slice(7, 15)}...` : 'None');
  
  if (!auth.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }

  const token = auth.slice(7).trim();
  
  if (!token || token.length < 10) {
    throw new Error("Invalid token format");
  }

  try {
    // Ensure JWT secret is available
    if (!env.JWT_SECRET) {
      throw new Error("JWT_SECRET not configured");
    }

    const { payload } = await jwtVerify(
      token,
      getJwtSecretKey(env.JWT_SECRET),
      {
        algorithms: ['HS256']
      }
    );

    console.log('✅ JWT verified, payload:', {
      id: payload.id,
      email: payload.email ? '***' : 'none',
      phone: payload.phone ? '***' : 'none',
      exp: payload.exp
    });

    // Validate payload structure
    if (!payload.email && !payload.phone) {
      throw new Error("Invalid token payload - missing user identifier");
    }

    // Return the user's email for identification
    const identifier = payload.email as string || payload.phone as string;
    if (!identifier) {
      throw new Error("Token missing user identifier");
    }
    
    return payload.email as string || ''; // Return email for backward compatibility
  } catch (error: any) {
    console.error("❌ JWT Verification error:", error.message || error);
    
    // Provide specific error messages
    if (error.code === 'ERR_JWT_EXPIRED' || error.message?.includes('expired')) {
      throw new Error("Token has expired - please log in again");
    } else if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      throw new Error("Invalid token signature");
    } else if (error.code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') {
      throw new Error("Token validation failed");
    } else {
      throw new Error(`Authentication failed: ${error.message || 'Unknown error'}`);
    }
  }
}

// Create JWT token with proper structure
export async function createJwtToken(
  payload: Record<string, any>, 
  secret: string, 
  expiresIn: string = "7d"
): Promise<string> {
  try {
    if (!secret) {
      throw new Error("JWT secret not provided");
    }

    // Clean and validate payload
    const cleanPayload = {
      id: Number(payload.id) || 0,
      email: payload.email || null,
      name: payload.name || '',
      phone: payload.phone || null,
    };

    console.log('🎫 Creating JWT for user:', {
      id: cleanPayload.id,
      email: cleanPayload.email ? '***' : 'none',
      phone: cleanPayload.phone ? '***' : 'none'
    });

    const jwt = new SignJWT(cleanPayload)
      .setProtectedHeader({ 
        alg: "HS256", 
        typ: "JWT" 
      })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .setJti(crypto.randomUUID()); // Add JWT ID for tracking

    const token = await jwt.sign(getJwtSecretKey(secret));
    
    // Validate the created token immediately
    try {
      const { payload: testPayload } = await jwtVerify(token, getJwtSecretKey(secret));
      console.log('✅ JWT created and validated successfully');
    } catch (testError) {
      console.error('❌ Created JWT is invalid:', testError);
      throw new Error('Failed to create valid JWT token');
    }
    
    return token;
  } catch (error: any) {
    console.error('❌ JWT creation error:', error);
    throw new Error(`Failed to create authentication token: ${error.message}`);
  }
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
  
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}
