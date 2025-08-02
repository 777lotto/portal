// worker/src/security/handler.ts
import { Context } from 'hono';
import { z } from 'zod';
import { AppEnv } from '../index.js';
import { User, UserSchema } from '@portal/shared';
import { createJwtToken, hashPassword, verifyPassword, getJwtSecretKey } from './auth.js';
import { errorResponse, successResponse } from '../utils.js';
import { deleteCookie } from 'hono/cookie';
import { getStripe, createStripeCustomer } from '../stripe/index.js';
import { SignJWT } from "jose";

// --- Zod Schemas for Payloads ---

// ADD: New schema for initializing the signup process
const InitializeSignupPayload = UserSchema.pick({ name: true, email: true, phone: true, company_name: true }).extend({
});

const CheckUserPayload = z.object({
    identifier: z.string().min(1),
});

const LoginPayload = z.object({
    email: z.string().email(),
    password: z.string(),
});

const RequestPasswordResetPayload = z.object({
    identifier: z.string(),
    channel: z.enum(['email', 'sms']),
});

const VerifyCodePayload = z.object({
    identifier: z.string(),
    code: z.string().min(6).max(6)
});

const SetPasswordPayload = z.object({
    password: z.string().min(8),
});

const GetUserFromTokenPayload = z.object({
    token: z.string(),
});


// --- Route Handlers ---

// ADD: New handler to create a guest user before sending a verification code.
export const handleInitializeSignup = async (c: Context<AppEnv>) => {
    const body = await c.req.json();
    const parsed = InitializeSignupPayload.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Invalid data provided.", 400, parsed.error.flatten());
    }

    const { name, email, company_name, phone } = parsed.data;
    const lowercasedEmail = email?.toLowerCase();
    const cleanedPhone = phone?.replace(/\D/g, '');

    try {
        // Create a guest user record without a password
        const { results } = await c.env.DB.prepare(
            `INSERT INTO users (name, email, company_name, phone, role) VALUES (?, ?, ?, ?, 'guest') RETURNING id, email, phone`
        ).bind(name, lowercasedEmail, company_name, cleanedPhone).all<{id: number, email: string, phone: string}>();

        if (!results || results.length === 0) {
            return errorResponse("Failed to initialize account.", 500);
        }

        const newUser = results[0];

        // Return info needed for the frontend to request a verification code
        return successResponse({
            user_id: newUser.id,
            email: newUser.email,
            phone: newUser.phone
        });

    } catch (e: any) {
        if (e.message?.includes('UNIQUE constraint failed')) {
            return errorResponse("An account with this email or phone number already exists.", 409);
        }
        console.error("Signup initialization error:", e);
        return errorResponse("An unexpected error occurred during signup.", 500);
    }
};


export const handleVerifyResetCode = async (c: Context<AppEnv>) => {
    const body = await c.req.json();
    const parsed = VerifyCodePayload.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Invalid data provided.", 400, parsed.error.flatten());
    }
    const { identifier, code } = parsed.data;

    try {
        const user = await c.env.DB.prepare(
            `SELECT id FROM users WHERE email = ? OR phone = ?`
        ).bind(identifier.toLowerCase(), identifier).first<User>();

        if (!user) {
            return errorResponse("Invalid code.", 400);
        }

        const tokenRecord = await c.env.DB.prepare(
            `SELECT user_id, due FROM password_reset_tokens WHERE token = ? AND user_id = ?`
        ).bind(code, user.id).first<{ user_id: number; due: string }>();

        if (!tokenRecord || new Date(tokenRecord.due) < new Date()) {
            if (tokenRecord) {
                await c.env.DB.prepare(`DELETE FROM password_reset_tokens WHERE token = ?`).bind(code).run();
            }
            return errorResponse("This code is invalid or has expired.", 400);
        }

        await c.env.DB.prepare(`DELETE FROM password_reset_tokens WHERE token = ?`).bind(code).run();

        const passwordSetToken = await new SignJWT({ purpose: 'password-set' })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(user.id.toString())
          .setIssuedAt()
          .setExpirationTime('10m')
          .sign(getJwtSecretKey(c.env.JWT_SECRET));

        return successResponse({ passwordSetToken });

    } catch (e: any) {
        console.error("Verify code error:", e);
        return errorResponse("An unexpected error occurred.", 500);
    }
};


export const handleLoginWithToken = async (c: Context<AppEnv>) => {
    const userToLogin = c.get('user');

    try {
        const user = await c.env.DB.prepare(
            `SELECT id, name, email, phone, role, stripe_customer_id, company_name FROM users WHERE id = ?`
        ).bind(userToLogin.id).first<User>();

        if (!user) {
            return errorResponse("User for this token not found.", 404);
        }

        const jwt = await createJwtToken(user, c.env.JWT_SECRET);
        return successResponse({ token: jwt, user });

    } catch (e: any) {
        console.error("Login with token error:", e);
        return errorResponse("An unexpected error occurred.", 500);
    }
};


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
            `SELECT email, phone, password_hash FROM users WHERE email = ? OR phone = ?`
        ).bind(lowercasedIdentifier, identifier).first<{ email?: string; phone?: string; password_hash?: string }>();

        if (!user) {
            return successResponse({ status: 'NEW' });
        }
        const responsePayload: { status: string; email?: string; phone?: string } = {
            status: user.password_hash ? 'EXISTING_WITH_PASSWORD' : 'EXISTING_NO_PASSWORD',
            email: user.email,
            phone: user.phone,
        };

        return successResponse(responsePayload);

    } catch (e: any) {
        console.error("Check user error:", e);
        return errorResponse("An unexpected error occurred.", 500);
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
            const token = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = new Date();
            expires.setMinutes(expires.getMinutes() + 10);

            await c.env.DB.prepare(
                `INSERT INTO password_reset_tokens (user_id, token, due) VALUES (?, ?, ?)`
            ).bind(user.id, token, expires.toISOString()).run();

            if (c.env.ENVIRONMENT === 'development') {
                console.log(`\n--- [WORKER] DEV ONLY | Verification Code for ${user.email || user.phone}: ${token} ---\n`);
            }

            const notificationPayload = {
                type: 'password_reset',
                user_id: user.id,
                data: { name: user.name, resetCode: token },
                channels: [channel]
            };

            if (c.env.ENVIRONMENT === 'development' && c.env.NOTIFICATION_SERVICE) {
                console.log("[worker] Awaiting direct fetch to notification service...");
                const res = await c.env.NOTIFICATION_SERVICE.fetch('http://localhost/api/notifications/send', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(notificationPayload)
                });
                console.log(`[worker] Direct fetch completed with status: ${res.status}`);
            } else {
                await c.env.NOTIFICATION_QUEUE.send(notificationPayload);
            }
        }
        return successResponse({ message: `If an account with that ${channel} exists, a verification code has been sent.` });

    } catch (e: any) {
        console.error("Password reset request failed:", e);
        return successResponse({ message: "If an account exists, a verification code has been sent." });
    }
};


// MODIFIED: This handler now activates guest accounts to customer accounts
export const handleSetPassword = async (c: Context<AppEnv>) => {
    const body = await c.req.json();
    const parsed = SetPasswordPayload.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Invalid data provided.", 400, parsed.error.flatten());
    }
    const { password } = parsed.data;

    const userToUpdate = c.get('user');

    try {
        const hashedPassword = await hashPassword(password);

        const currentUser = await c.env.DB.prepare(`SELECT role FROM users WHERE id = ?`).bind(userToUpdate.id).first<{role: string}>();
        const isNewUserSignup = currentUser?.role === 'guest';

        const updateQuery = isNewUserSignup
            ? `UPDATE users SET password_hash = ?, role = 'customer' WHERE id = ?`
            : `UPDATE users SET password_hash = ? WHERE id = ?`;

        await c.env.DB.prepare(updateQuery).bind(hashedPassword, userToUpdate.id).run();

        const user = await c.env.DB.prepare(
            `SELECT id, name, email, phone, role, stripe_customer_id, company_name FROM users WHERE id = ?`
        ).bind(userToUpdate.id).first<User>();

        if (!user) return errorResponse("Could not find user after password update.", 500);

        if (isNewUserSignup) {
            if (!user.stripe_customer_id) {
                const stripe = getStripe(c.env);
                const customer = await createStripeCustomer(stripe, user);
                await c.env.DB.prepare(
                    `UPDATE users SET stripe_customer_id = ? WHERE id = ?`
                ).bind(customer.id, user.id).run();
                user.stripe_customer_id = customer.id;
            }

            try {
                await c.env.NOTIFICATION_QUEUE.send({
                  type: 'welcome',
                  user_id: user.id,
                  data: { name: user.name },
                  channels: ['email', 'sms']
                });
            } catch (queueError: any) {
                console.error(`Failed to enqueue welcome notification for user ${user.id}:`, queueError);
            }
        }

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
            `SELECT user_id, due FROM password_reset_tokens WHERE token = ?`
        ).bind(token).first<{ user_id: number; due: string }>();

        if (!tokenRecord || new Date(tokenRecord.due) < new Date()) {
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
