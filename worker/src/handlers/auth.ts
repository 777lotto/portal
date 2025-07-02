// 777lotto/portal/portal-bet/worker/src/handlers/auth.ts
import { Context } from 'hono';
import { z } from 'zod';
import { AppEnv } from '../index.js';
import { User, UserSchema } from '@portal/shared';
import { createJwtToken, hashPassword, verifyPassword, validateTurnstileToken } from '../auth.js';
import { errorResponse, successResponse } from '../utils.js';
import { deleteCookie } from 'hono/cookie';

const SignupPayload = UserSchema.pick({ name: true, email: true, phone: true }).extend({
    password: z.string().min(8),
    'cf-turnstile-response': z.string(),
});

const LoginPayload = z.object({
    email: z.string().email(),
    password: z.string(),
    'cf-turnstile-response': z.string(),
});

export const handleSignup = async (c: Context<AppEnv>) => {
    const body = await c.req.json();
    const parsed = SignupPayload.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Invalid signup data", 400);
    }

    const { name, email, password, phone } = parsed.data;
    const lowercasedEmail = email.toLowerCase();

    const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
    const turnstileSuccess = await validateTurnstileToken(parsed.data['cf-turnstile-response'], ip, c.env);
    if (!turnstileSuccess) {
        return errorResponse("Invalid Turnstile token. Please try again.", 403);
    }

    try {
        const existingUser = await c.env.DB.prepare(
            `SELECT id, password_hash FROM users WHERE email = ?`
        ).bind(lowercasedEmail).first<{id: number, password_hash: string | null}>();

        if (existingUser && existingUser.password_hash) {
            // User exists and has a password. They should log in.
            return errorResponse("An account with this email already exists. Please log in or use password reset.", 409);
        }

        const hashedPassword = await hashPassword(password);
        let userForToken: User;

        if (existingUser) {
            // User exists but has no password. Update their record to set one.
            const { results } = await c.env.DB.prepare(
                `UPDATE users SET password_hash = ?, name = ?, phone = ? WHERE id = ? RETURNING id, name, email, phone, role`
            ).bind(hashedPassword, name, phone, existingUser.id).all<User>();

            if (!results || results.length === 0) {
                return errorResponse("Failed to update your account. Please contact support.", 500);
            }
            userForToken = results[0];
        } else {
            // User does not exist, create a new one.
            const { results } = await c.env.DB.prepare(
                `INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, 'customer') RETURNING id, name, email, phone, role`
            ).bind(name, lowercasedEmail, hashedPassword, phone).all<User>();

            if (!results || results.length === 0) {
                return errorResponse("Failed to create account.", 500);
            }
            userForToken = results[0];
        }

        const token = await createJwtToken(userForToken, c.env.JWT_SECRET);
        return successResponse({ token, user: userForToken });

    } catch (e: any) {
        // This will catch unexpected DB errors, but not the unique constraint anymore.
        if (e.message?.includes('UNIQUE constraint failed')) {
            // This is a race condition fallback, in case a user is created between the SELECT and INSERT.
             return errorResponse("An account with this email already exists.", 409);
        }
        console.error("Signup error:", e);
        return errorResponse("An unexpected error occurred during signup.", 500);
    }
};

export const handleLogin = async (c: Context<AppEnv>) => {
    const body = await c.req.json();
    const parsed = LoginPayload.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Invalid login data", 400);
    }

    const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
    const turnstileSuccess = await validateTurnstileToken(parsed.data['cf-turnstile-response'], ip, c.env);
    if (!turnstileSuccess) {
        return errorResponse("Invalid Turnstile token. Please try again.", 403);
    }

    const { email, password } = parsed.data;

    try {
        const user = await c.env.DB.prepare(
            `SELECT id, name, email, phone, role, password_hash, stripe_customer_id FROM users WHERE email = ?`
        ).bind(email.toLowerCase()).first<User & { password_hash?: string }>();

        if (!user || !user.password_hash) {
            return errorResponse("Invalid email or password.", 401);
        }

        const validPassword = await verifyPassword(password, user.password_hash);
        if (!validPassword) {
            return errorResponse("Invalid email or password.", 401);
        }

        delete user.password_hash; // Do not include hash in JWT or response

        const token = await createJwtToken(user as User, c.env.JWT_SECRET);
        return successResponse({ token, user: user as User });
    } catch (e: any) {
        console.error("Login error:", e);
        return errorResponse("Login failed.", 500);
    }
};

export const handleRequestPasswordReset = async (c: Context<AppEnv>) => {
    const { email } = await c.req.json();
    if (!email) return errorResponse("Email is required", 400);

    console.log(`Password reset requested for: ${email}`);
    return successResponse({ message: "If an account with that email exists, a password reset link has been sent." });
};

export const handleLogout = async (c: Context<AppEnv>) => {
  // Clear the 'session' cookie. Ensure the path and domain match
  // how it was set during login if applicable.
  deleteCookie(c, 'session', {
    path: '/',
    // secure: true, // Recommended for production
    // httpOnly: true, // Recommended for production
  });
  return successResponse({ message: "Logged out successfully" });
};
