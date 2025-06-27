import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { nanoid } from 'nanoid';
import { TimeSpan, createDate } from 'oslo';
import { sha256 } from 'oslo/crypto';
import { alphabet, generateRandomString } from 'oslo/random';
// FIX: Import the Session type from the shared package instead of using a local definition.
import type { Session } from '@portal/shared';
import type { Env } from '.';
import type { User as LuciaUser } from 'lucia';
import { Argon2id } from 'oslo/password';

// REMOVED: The local Session interface was incorrect (e.g., `phone` was not nullable).
// Using the one from `@portal/shared` ensures consistency.
/*
export interface Session {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: 'user' | 'admin';
  };
  expires: string;
}
*/

export interface AuthUser {
  id: string;
  role: 'admin' | 'user';
  email: string;
  name: string;
  phone: string | null;
}

export const createSession = async (
  env: Env,
  userId: string,
): Promise<string> => {
  const sessionId = nanoid();
  const expiresAt = createDate(new TimeSpan(30, 'd'));

  const db = env.DB;
  const user = await db
    .selectFrom('users')
    .select(['id', 'name', 'email', 'phone', 'role'])
    .where('id', '=', userId)
    .executeTakeFirst();

  if (user) {
    const session: Session = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone, // This is now correctly typed as `string | null` from the shared Session type
        role: user.role as 'user' | 'admin',
      },
      expires: expiresAt.toUTCString(),
    };
    await env.SESSION_KV.put(sessionId, JSON.stringify(session), {
      expirationTtl: 30 * 24 * 60 * 60, // 30 days
    });
  }

  return sessionId;
};

// ... rest of the file is unchanged
export const getSession = async (env: Env, sessionId: string): Promise<Session | null> => {
  const sessionData = await env.SESSION_KV.get(sessionId);
  if (!sessionData) {
    return null;
  }
  const session: Session = JSON.parse(sessionData);
  if (new Date(session.expires) < new Date()) {
    await env.SESSION_KV.delete(sessionId);
    return null;
  }
  return session;
};

export const validateRequest = async (
  env: Env,
  req: Request,
): Promise<AuthUser | null> => {
  const sessionId = getCookie(req.headers.get('Cookie'), 'session_id');
  if (!sessionId) {
    return null;
  }
  const session = await getSession(env, sessionId);
  return session?.user ?? null;
};

export const deleteSession = async (env: Env, sessionId: string) => {
  await env.SESSION_KV.delete(sessionId);
};

export const hashPassword = async (password: string): Promise<string> => {
    return new Argon2id().hash(password);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    return new Argon2id().verify(hash, password);
};
