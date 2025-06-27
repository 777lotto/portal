import { Context } from 'hono';
import { z } from 'zod';
import { AppEnv } from '../index';
import { UserSchema } from '@portal/shared';
import { createJwtToken, hashPassword, verifyPassword, validateTurnstileToken } from '../auth';
import { errorResponse, successResponse } from '../utils';

const SignupPayload = UserSchema.pick({ name: true, email: true, phone: true }).extend({
    password: z.string().min(8),
    'cf-turnstile-response': z.string(),
});

const LoginPayload = z.object({
    email: z.string().email(),
    password: z.string(),
});

export const handleSignup = async (c: Context<AppEnv>) => {
    const body = await c.req.json();
    const parsed = SignupPayload.safeParse(body);
    if (!parsed.success) {
        return errorResponse("Invalid signup data", 400, parsed.error.flatten());
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
            `INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, 'customer') RETURNING id, name, email, phone, role`
        ).bind(name, email.toLowerCase(), hashedPassword, phone).all();

        const newUser = results[0] as User;
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
        return errorResponse("Invalid login data", 400, parsed.error.flatten());
    }

    const { email, password } = parsed.data;

    try {
        const user = await c.env.DB.prepare(
            `SELECT id, name, email, phone, role, password, stripe_customer_id FROM users WHERE email = ?`
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
    // This is a placeholder. A real implementation would:
    // 1. Validate the email exists.
    // 2. Generate a unique, short-lived token and store it with the user ID.
    // 3. Send the token to the notification worker to email a reset link.
    const { email } = await c.req.json();
    if (!email) return errorResponse("Email is required", 400);

    console.log(`Password reset requested for: ${email}`);
    // In a real app, you would now trigger the notification worker
    return successResponse({ message: "If an account with that email exists, a password reset link has been sent." });
};
