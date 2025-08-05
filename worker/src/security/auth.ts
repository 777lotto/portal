// worker/src/security/auth.ts
import { createFactory } from 'hono/factory';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import type { User } from '@portal/shared';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '../server';

const factory = createFactory<AppEnv>();

export function getJwtSecretKey(secret: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(secret);
}

// --- REFACTORED: All middleware now use the createFactory pattern ---

export const requireAuthMiddleware = factory.createMiddleware(async (c, next) => {
  let token: string | undefined;
  const authHeader = c.req.header('Authorization');
  const upgradeHeader = c.req.header('Upgrade');

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (upgradeHeader?.toLowerCase() === 'websocket') {
    token = c.req.query('token');
  }

  if (!token) {
    throw new HTTPException(401, { message: 'Missing or invalid authorization token' });
  }

  try {
    const secret = getJwtSecretKey(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    c.set('user', payload as User);
    await next();
  } catch (error) {
    throw new HTTPException(401, { message: 'Authentication failed: Invalid token' });
  }
});

export const requireAdminAuthMiddleware = factory.createMiddleware(async (c, next) => {
  const user = c.get('user');
  if (user?.role !== 'admin') {
    throw new HTTPException(403, { message: 'Forbidden: Admin access required' });
  }
  await next();
});

export const requirePasswordSetToken = factory.createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid authorization header' });
  }
  const token = authHeader.substring(7);

  try {
    const secret = getJwtSecretKey(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    if (payload.purpose !== 'password-set' || !payload.sub) {
      throw new HTTPException(403, { message: 'Forbidden: Invalid token type' });
    }

    c.set('user', { id: payload.sub } as unknown as User);
    await next();
  } catch (error) {
    throw new HTTPException(401, { message: 'Authentication failed: Invalid token' });
  }
});

// --- Helper functions remain the same ---

export async function createJwtToken(user: User, secret: string, expiresIn: string = '7d'): Promise<string> {
  const jwt = new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setJti(crypto.randomUUID());
  return jwt.sign(getJwtSecretKey(secret));
}

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  return await bcrypt.compare(password, hash);
}
