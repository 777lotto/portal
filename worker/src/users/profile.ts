import { createFactory } from 'hono/factory';
import { clerkAuth, getAuth } from '@hono/clerk-auth';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { db } from '../../db';
import { users, uiNotifications } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { UserSchema, type UINotification } from '@portal/shared';
import { verifyPassword, hashPassword } from '../../security/auth';
import { getStripe, listPaymentMethods, createSetupIntent } from '../../stripe';

const factory = createFactory();

// --- Zod Schemas for Validation ---
const UpdateProfilePayload = UserSchema.pick({
	name: true,
	email: true,
	phone: true,
	company_name: true,
	address: true,
	email_notifications_enabled: true,
	sms_notifications_enabled: true,
	preferred_contact_method: true,
}).partial();

const ChangePasswordPayload = z.object({
	currentPassword: z.string(),
	newPassword: z.string().min(8),
});

// --- Middleware to get the full user object from the database ---
const userMiddleware = factory.createMiddleware(async (c, next) => {
	const auth = getAuth(c);
	if (!auth?.userId) {
		throw new HTTPException(401, { message: 'Unauthorized' });
	}
	const database = db(c.env.DB);
	const user = await database.select().from(users).where(eq(users.clerk_id, auth.userId)).get();
	if (!user) {
		throw new HTTPException(404, { message: 'User not found' });
	}
	c.set('user', user);
	await next();
});

// --- Route Handlers ---

export const getProfile = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	return c.json({ profile: user });
});

export const updateProfile = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const body = await c.req.json();
	const parsed = UpdateProfilePayload.safeParse(body);

	if (!parsed.success) {
		throw new HTTPException(400, { message: 'Invalid data', cause: parsed.error });
	}

	const database = db(c.env.DB);
	try {
		const updatedUser = await database.update(users).set(parsed.data).where(eq(users.id, user.id)).returning().get();

		// Also update Stripe customer if necessary
		if (user.stripe_customer_id && (parsed.data.name || parsed.data.company_name)) {
			const stripe = getStripe(c.env);
			await stripe.customers.update(user.stripe_customer_id, {
				name: parsed.data.name,
				metadata: { company_name: parsed.data.company_name || '' },
			});
		}

		return c.json({ profile: updatedUser });
	} catch (e: any) {
		if (e.message?.includes('UNIQUE constraint failed')) {
			throw new HTTPException(409, { message: 'That email or phone number is already in use.' });
		}
		console.error('Failed to update profile:', e);
		throw new HTTPException(500, { message: 'Failed to update profile' });
	}
});

export const changePassword = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const body = await c.req.json();
	const parsed = ChangePasswordPayload.safeParse(body);

	if (!parsed.success) {
		throw new HTTPException(400, { message: 'Invalid password data', cause: parsed.error });
	}

	if (!user.password_hash) {
		throw new HTTPException(400, { message: 'User does not have a password set.' });
	}

	const isCorrect = await verifyPassword(parsed.data.currentPassword, user.password_hash);
	if (!isCorrect) {
		throw new HTTPException(401, { message: 'Incorrect current password.' });
	}

	const newHashedPassword = await hashPassword(parsed.data.newPassword);
	const database = db(c.env.DB);
	await database.update(users).set({ password_hash: newHashedPassword }).where(eq(users.id, user.id)).run();

	return c.json({ success: true, message: 'Password updated successfully.' });
});

export const getPaymentMethods = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	if (!user.stripe_customer_id) {
		return c.json({ paymentMethods: [] });
	}
	const stripe = getStripe(c.env);
	const paymentMethods = await listPaymentMethods(stripe, user.stripe_customer_id);
	return c.json({ paymentMethods: paymentMethods.data });
});

export const createStripeSetupIntent = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	if (!user.stripe_customer_id) {
		throw new HTTPException(400, { message: 'User is not a Stripe customer' });
	}
	const stripe = getStripe(c.env);
	const setupIntent = await createSetupIntent(stripe, user.stripe_customer_id);
	return c.json({ clientSecret: setupIntent.client_secret });
});

export const getNotifications = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const database = db(c.env.DB);
	try {
		const notifications = await database.select().from(uiNotifications).where(eq(uiNotifications.user_id, user.id)).orderBy(uiNotifications.createdAt).limit(20).all();
		return c.json({ notifications });
	} catch (e: any) {
		console.error('Failed to get notifications:', e);
		throw new HTTPException(500, { message: 'Failed to retrieve notifications' });
	}
});

export const markAllNotificationsRead = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const database = db(c.env.DB);
	try {
		await database.update(uiNotifications).set({ is_read: true }).where(eq(uiNotifications.user_id, user.id)).run();
		return c.json({ success: true });
	} catch (e: any) {
		console.error('Failed to mark notifications as read:', e);
		throw new HTTPException(500, { message: 'Failed to mark notifications as read' });
	}
});
