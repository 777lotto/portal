// worker/src/handlers/auth.ts - CORRECTED
import { Context } from 'hono';
import { z } from 'zod';
import { AppEnv } from '../index';
import { User, UserSchema } from '@portal/shared';
import { createJwtToken, hashPassword, verifyPassword, validateTurnstileToken } from '../auth';
import { errorResponse, successResponse } from '../utils';
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
    const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
    const turnstileSuccess = await validateTurnstileToken(parsed.data['cf-turnstile-response'], ip, c.env);
    if (!turnstileSuccess) {
        return errorResponse("Invalid Turnstile token. Please try again.", 403);
    }

    try {
        const hashedPassword = await hashPassword(password);
        const { results } = await c.env.DB.prepare(
            `INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, 'customer') RETURNING id, name, email, phone, role`
        ).bind(name, email.toLowerCase(), hashedPassword, phone).all<User>();

        if (!results || results.length === 0) {
            return errorResponse("Failed to create account.", 500);
        }

        const newUser = results[0];
        const token = await createJwtToken(newUser, c.env.JWT_SECRET);
        return successResponse({ token, user: newUser });

    } catch (e: any) {
        if (e.message?.includes('UNIQUE constraint failed')) {
            return errorResponse("An account with this email already exists.", 409);
        }
        console.error("Signup error:", e);
        return errorResponse("Failed to create account.", 500);
    }
};

export const handleLogin = async (c: Context<AppEnv>) => {
    const body = await c.req.json();
    const parsed = LoginPayload.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Invalid login data", 400);
    }

    const { email, password } = parsed.data;

    try {
        const user = await c.env.DB.prepare(
            `SELECT id, name, email, phone, role, password_hash, stripe_customer_id FROM users WHERE email = ?`
        ).bind(email.toLowerCase()).first<User & { password?: string }>();

        if (!user || !user.password) {
            return errorResponse("Invalid email or password.", 401);
        }

        const validPassword = await verifyPassword(password, user.password);
        if (!validPassword) {
            return errorResponse("Invalid email or password.", 401);
        }

        delete user.password; // Do not include hash in JWT or response

        const token = await createJwtToken(user, c.env.JWT_SECRET);
        return successResponse({ token, user });
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
