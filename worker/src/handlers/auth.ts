// 777lotto/portal/portal-bet/worker/src/handlers/auth.ts
import { Context } from 'hono';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AppEnv } from '../index.js';
import { User, UserSchema } from '@portal/shared';
import { createJwtToken, hashPassword, verifyPassword, validateTurnstileToken } from '../auth.js';
import { errorResponse, successResponse } from '../utils.js';
import { deleteCookie } from 'hono/cookie';
// --- NEW: Import Stripe functions ---
import { getStripe, createStripeCustomer } from '../stripe.js';


const SignupPayload = UserSchema.pick({ name: true, email: true, phone: true }).extend({
    password: z.string().min(8),
    'cf-turnstile-response': z.string(),
});

const LoginPayload = z.object({
    email: z.string().email(),
    password: z.string(),
    'cf-turnstile-response': z.string(),
});

const RequestPasswordResetPayload = z.object({
    identifier: z.string(), // Can be email or phone
    channel: z.enum(['email', 'sms']),
});


export const handleSignup = async (c: Context<AppEnv>) => {
    const body = await c.req.json();
    const parsed = SignupPayload.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Invalid signup data", 400, parsed.error.flatten());
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
            `SELECT id, name, password_hash FROM users WHERE email = ? OR phone = ?`
        ).bind(lowercasedEmail, phone).first<User & { password_hash?: string }>();

        if (existingUser) {
            // Case 1: User exists and has a password. They should log in.
            if (existingUser.password_hash) {
                return errorResponse("An account with this email or phone number already exists. Please log in.", 409);
            }

            // Case 2: User exists but is a guest (no password). Send a link to set one.
            const token = uuidv4();
            const expires = new Date();
            expires.setHours(expires.getHours() + 1); // Token expires in 1 hour

            await c.env.DB.prepare(
                `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`
            ).bind(existingUser.id, token, expires.toISOString()).run();

            const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');
            const resetLink = `${portalBaseUrl}/set-password?token=${token}`;
            const channel = existingUser.email === lowercasedEmail ? 'email' : 'sms';

            await c.env.NOTIFICATION_QUEUE.send({
                type: 'password_reset',
                userId: existingUser.id,
                data: { name: existingUser.name, resetLink: resetLink },
                channels: [channel]
            });

            const message = `You already have an account. We've sent a link to your ${channel} to set your password.`;
            return errorResponse(message, 409, { code: "PASSWORD_SET_REQUIRED" });
        }


        // Case 3: No user exists. Create a new one.
        const hashedPassword = await hashPassword(password);
        const { results } = await c.env.DB.prepare(
            `INSERT INTO users (name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, 'customer') RETURNING id, name, email, phone, role, stripe_customer_id`
        ).bind(name, lowercasedEmail, hashedPassword, phone).all<User>();


        if (!results || results.length === 0) {
            return errorResponse("Failed to create account.", 500);
        }
        let userForToken = results[0];


        // --- NEW: Create a Stripe customer and link it to the user ---
        if (!userForToken.stripe_customer_id) {
            const stripe = getStripe(c.env);
            const customer = await createStripeCustomer(stripe, userForToken);
            await c.env.DB.prepare(
                `UPDATE users SET stripe_customer_id = ? WHERE id = ?`
            ).bind(customer.id, userForToken.id).run();
            userForToken.stripe_customer_id = customer.id;
            console.log(`Created Stripe customer ${customer.id} for user ${userForToken.id}`);
        }
        // --- END NEW ---

        // ADDED: Enqueue a welcome notification
        try {
            await c.env.NOTIFICATION_QUEUE.send({
              type: 'welcome',
              userId: userForToken.id,
              data: { name: userForToken.name }, // Pass any data the template might need
              channels: ['email', 'sms'] // You can choose which channels to use
            });
            console.log(`Enqueued 'welcome' notification for user ${userForToken.id}`);
        } catch (queueError: any) {
            console.error(`Failed to enqueue welcome notification for user ${userForToken.id}:`, queueError);
            // Non-fatal error, so we don't block the user from signing up
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
    const body = await c.req.json();
    const parsed = RequestPasswordResetPayload.safeParse(body);

    if (!parsed.success) {
        return errorResponse("Invalid request data", 400, parsed.error.flatten());
    }

    const { identifier, channel } = parsed.data;

    try {
        const user = await c.env.DB.prepare(
            `SELECT id, name, email, phone FROM users WHERE email = ? OR phone = ?`
        ).bind(identifier, identifier).first<User>();

        if (user) {
            // Check if the requested channel is valid for the user
            if ((channel === 'email' && !user.email) || (channel === 'sms' && !user.phone)) {
                // Log this attempt but return a generic message
                console.warn(`Password reset for user ${user.id} requested for unavailable channel ${channel}`);
            } else {
                const token = uuidv4();
                const expires = new Date();
                expires.setHours(expires.getHours() + 1); // Token expires in 1 hour

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
                console.log(`Enqueued 'password_reset' notification for user ${user.id} via ${channel}`);
            }
        } else {
            console.log(`Password reset requested for non-existent user: ${identifier}`);
        }

        // Always return a generic success message to prevent user enumeration attacks
        return successResponse({ message: "If an account with that identifier exists, a password reset link has been sent to the selected channel." });

    } catch (e: any) {
        console.error("Password reset request failed:", e);
        return successResponse({ message: "If an account with that identifier exists, a password reset link has been sent to the selected channel." });
    }
};


export const handleLogout = async (c: Context<AppEnv>) => {
  deleteCookie(c, 'session', {
    path: '/',
  });
  return successResponse({ message: "Logged out successfully" });
};
