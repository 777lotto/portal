// 777lotto/portal/portal-bet/worker/src/handlers/auth.ts
import { Context } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AppEnv } from '../index.js';
import { User, UserSchema } from '@portal/shared';
import { createJwtToken, hashPassword, verifyPassword, validateTurnstileToken } from '../auth.js';
import { errorResponse, successResponse } from '../utils.js';
import { deleteCookie } from 'hono/cookie';
import { getStripe, createStripeCustomer } from '../stripe.js';

// --- Zod Schemas for Payloads ---

const CheckUserPayload = z.object({
    identifier: z.string().min(1),
});

const SignupPayload = UserSchema.pick({ name: true, email: true, phone: true, company_name: true }).extend({
    password: z.string().min(8),
    'cf-turnstile-response': z.string(),
});

const LoginPayload = z.object({
    email: z.string().email(),
    password: z.string(),
    'cf-turnstile-response': z.string(),
});

const RequestPasswordResetPayload = z.object({
    identifier: z.string(),
    channel: z.enum(['email', 'sms']),
});

const SetPasswordPayload = z.object({
    token: z.string(),
    password: z.string().min(8),
    name: z.string().min(1),
});

const GetUserFromTokenPayload = z.object({
    token: z.string(),
});


// --- Route Handlers ---

export const handleCheckUser = async (c: Context<AppEnv>) => {
    const body = await c.req.json();
    const parsed = CheckUserPayload.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Invalid identifier provided", 400, parsed.error.flatten());
    }
    const { identifier } = parsed.data;
    const lowercasedIdentifier = identifier.toLowerCase();

    try {
        const user = await c.env.DB.prepare(
            `SELECT password_hash FROM users WHERE email = ? OR phone = ?`
        ).bind(lowercasedIdentifier, identifier).first<{ password_hash?: string }>();

        if (!user) {
            return successResponse({ status: 'NEW' });
        }
        if (user.password_hash) {
            return successResponse({ status: 'EXISTING_WITH_PASSWORD' });
        }
        return successResponse({ status: 'EXISTING_NO_PASSWORD' });
    } catch (e: any) {
        console.error("Check user error:", e);
        return errorResponse("An unexpected error occurred.", 500);
    }
};

export const handleSignup = async (c: Context<AppEnv>) => {
    const body = await c.req.json();
    const parsed = SignupPayload.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Invalid signup data", 400, parsed.error.flatten());
    }

    const { name, email, password, phone, company_name } = parsed.data;
    const lowercasedEmail = email.toLowerCase();

    const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
    const turnstileSuccess = await validateTurnstileToken(parsed.data['cf-turnstile-response'], ip, c.env);
    if (!turnstileSuccess) {
        return errorResponse("Invalid Turnstile token. Please try again.", 403);
    }

    try {
        const hashedPassword = await hashPassword(password);
        const { results } = await c.env.DB.prepare(
            `INSERT INTO users (name, email, password_hash, phone, company_name, role) VALUES (?, ?, ?, ?, ?, 'customer') RETURNING id, name, email, phone, role, stripe_customer_id, company_name`
        ).bind(name, lowercasedEmail, hashedPassword, phone, company_name).all<User>();

        if (!results || results.length === 0) {
            return errorResponse("Failed to create account.", 500);
        }
        let userForToken = results[0];

        if (!userForToken.stripe_customer_id) {
            const stripe = getStripe(c.env);
            const customer = await createStripeCustomer(stripe, userForToken);
            await c.env.DB.prepare(
                `UPDATE users SET stripe_customer_id = ? WHERE id = ?`
            ).bind(customer.id, userForToken.id).run();
            userForToken.stripe_customer_id = customer.id;
        }

        try {
            await c.env.NOTIFICATION_QUEUE.send({
              type: 'welcome',
              userId: userForToken.id,
              data: { name: userForToken.name },
              channels: ['email', 'sms']
            });
        } catch (queueError: any) {
            console.error(`Failed to enqueue welcome notification for user ${userForToken.id}:`, queueError);
        }

        const token = await createJwtToken(userForToken, c.env.JWT_SECRET);
        return successResponse({ token, user: userForToken });

    } catch (e: any) {
        if (e.message?.includes('UNIQUE constraint failed')) {
             return errorResponse("An account with this email or phone number already exists.", 409);
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
            `SELECT id, name, email, phone, role, password_hash, stripe_customer_id, company_name FROM users WHERE email = ?`
        ).bind(email.toLowerCase()).first<User & { password_hash?: string }>();

        if (!user || !user.password_hash) {
            return errorResponse("Invalid email or password.", 401);
        }

        const validPassword = await verifyPassword(password, user.password_hash);
        if (!validPassword) {
            return errorResponse("Invalid email or password.", 401);
        }

        delete user.password_hash;

        const token = await createJwtToken(user as User, c.env.JWT_SECRET);
        return successResponse({ token, user: user as User });
    } catch (e: any) {
        console.error("Login error:", e);
        return errorResponse("Login failed.", 500);
    }
};

export const handleRequestPasswordReset = async (c: Context<AppEnv>) => {
    const body = await c.req.json();
    const parsed = RequestPasswordResetPayload.safeParse(body);

    if (!parsed.success) {
        return errorResponse("Invalid request data", 400, parsed.error.flatten());
    }

    const { identifier, channel } = parsed.data;

    try {
        const user = await c.env.DB.prepare(
            `SELECT id, name, email, phone FROM users WHERE email = ? OR phone = ?`
        ).bind(identifier.toLowerCase(), identifier).first<User>();

        if (user) {
            if ((channel === 'email' && !user.email) || (channel === 'sms' && !user.phone)) {
                 console.warn(`Password reset for user ${user.id} requested for unavailable channel ${channel}`);
            } else {
                const token = uuidv4();
                const expires = new Date();
                expires.setHours(expires.getHours() + 1);

                await c.env.DB.prepare(
                    `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`
                ).bind(user.id, token, expires.toISOString()).run();

                const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');
                const resetLink = `${portalBaseUrl}/set-password?token=${token}`;

                await c.env.NOTIFICATION_QUEUE.send({
                    type: 'password_reset',
                    userId: user.id,
                    data: { name: user.name, resetLink: resetLink },
                    channels: [channel]
                });
            }
        }
        return successResponse({ message: "If an account with that identifier exists, a password reset link has been sent." });

    } catch (e: any) {
        console.error("Password reset request failed:", e);
        return successResponse({ message: "If an account with that identifier exists, a password reset link has been sent." });
    }
};

export const handleSetPassword = async (c: Context<AppEnv>) => {
    const body = await c.req.json();
    const parsed = SetPasswordPayload.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Invalid data provided.", 400, parsed.error.flatten());
    }
    const { token, password, name } = parsed.data;

    try {
        const tokenRecord = await c.env.DB.prepare(
            `SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?`
        ).bind(token).first<{ user_id: number; expires_at: string }>();

        if (!tokenRecord || new Date(tokenRecord.expires_at) < new Date()) {
            if (tokenRecord) {
                await c.env.DB.prepare(`DELETE FROM password_reset_tokens WHERE token = ?`).bind(token).run();
            }
            return errorResponse("This link is invalid or has expired. Please request a new one.", 400);
        }

        const hashedPassword = await hashPassword(password);
        await c.env.DB.prepare(
            `UPDATE users SET password_hash = ?, name = ? WHERE id = ?`
        ).bind(hashedPassword, name, tokenRecord.user_id).run();

        await c.env.DB.prepare(`DELETE FROM password_reset_tokens WHERE token = ?`).bind(token).run();

        const user = await c.env.DB.prepare(
            `SELECT id, name, email, phone, role, stripe_customer_id, company_name FROM users WHERE id = ?`
        ).bind(tokenRecord.user_id).first<User>();

        if (!user) return errorResponse("Could not find user after password update.", 500);

        const jwt = await createJwtToken(user, c.env.JWT_SECRET);
        return successResponse({ token: jwt, user });

    } catch (e: any) {
        console.error("Set password error:", e);
        return errorResponse("An unexpected error occurred.", 500);
    }
};

export const handleGetUserFromResetToken = async (c: Context<AppEnv>) => {
    const token = c.req.query('token');
    const parsed = GetUserFromTokenPayload.safeParse({ token });
    if (!parsed.success) {
        return errorResponse("Invalid or missing token.", 400);
    }

    try {
        const tokenRecord = await c.env.DB.prepare(
            `SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?`
        ).bind(token).first<{ user_id: number; expires_at: string }>();

        if (!tokenRecord || new Date(tokenRecord.expires_at) < new Date()) {
            return errorResponse("This password reset link is invalid or has expired.", 400);
        }

        const user = await c.env.DB.prepare(
            `SELECT name, email, phone FROM users WHERE id = ?`
        ).bind(tokenRecord.user_id).first<{ name: string; email: string; phone: string | null }>();

        if (!user) return errorResponse("User not found.", 404);
        return successResponse(user);

    } catch (e: any) {
        console.error("Get user from reset token error:", e);
        return errorResponse("An unexpected error occurred.", 500);
    }
};

export const handleLogout = async (c: Context<AppEnv>) => {
  deleteCookie(c, 'session', { path: '/' });
  return successResponse({ message: "Logged out successfully" });
};
