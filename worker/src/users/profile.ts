import { createFactory } from 'hono/factory';
import { getAuth } from '@hono/clerk-auth';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db';
import { users, uiNotifications } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { verifyPassword, hashPassword } from '../../security/auth';
import { getStripe, listPaymentMethods, createSetupIntent } from '../../stripe';

const factory = createFactory();

// --- Middleware to get the full user object from the database ---
// This middleware ensures that for every handler in this file, we have the
// full, up-to-date user object from our database, not just the JWT payload.
const userMiddleware = factory.createMiddleware(async (c, next) => {
	const auth = getAuth(c);
	if (!auth?.userId) {
		throw new HTTPException(401, { message: 'Unauthorized' });
	}

	const database = db(c.env.DB);
	const user = await database.select().from(users).where(eq(users.clerk_id, auth.userId)).get();

	if (!user) {
		throw new HTTPException(401, { message: 'User not found in database.' });
	}
	// Make the full user object available to the handler
	c.set('user', user);
	await next();
});

// --- Route Handlers ---

/**
 * Retrieves the profile of the currently authenticated user.
 */
export const getProfile = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	// The response is wrapped in a "profile" key
	return c.json({ profile: user });
});

/**
 * Updates the profile of the currently authenticated user.
 * REFACTORED: Assumes the payload is validated by `zValidator`.
 */
export const updateProfile = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const validatedData = c.req.valid('json');
	const database = db(c.env.DB);

	const [updatedUser] = await database
		.update(users)
		.set(validatedData)
		.where(eq(users.id, user.id))
		.returning();

	return c.json({ profile: updatedUser });
});

/**
 * Changes the password for the currently authenticated user.
 * REFACTORED: Assumes the payload is validated by `zValidator`.
 */
export const changePassword = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const { currentPassword, newPassword } = c.req.valid('json');
	const database = db(c.env.DB);

	if (!user.hashed_password) {
		throw new HTTPException(400, { message: 'Password cannot be changed for social logins.' });
	}

	const isMatch = await verifyPassword(currentPassword, user.hashed_password);
	if (!isMatch) {
		throw new HTTPException(400, { message: 'Incorrect current password.' });
	}

	const newHashedPassword = await hashPassword(newPassword);
	await database.update(users).set({ hashed_password: newHashedPassword }).where(eq(users.id, user.id));

	return c.json({ success: true, message: 'Password updated successfully.' });
});

/**
 * Retrieves the Stripe payment methods for the current user.
 */
export const getPaymentMethods = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	if (!user.stripe_customer_id) {
		return c.json({ paymentMethods: [] }); // Return empty array if not a stripe customer
	}

	const stripe = getStripe(c.env);
	const paymentMethods = await listPaymentMethods(stripe, user.stripe_customer_id);

	return c.json({ paymentMethods: paymentMethods.data });
});

/**
 * Creates a Stripe Setup Intent to add a new payment method.
 */
export const createStripeSetupIntent = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	if (!user.stripe_customer_id) {
		throw new HTTPException(400, { message: 'User is not a Stripe customer.' });
	}

	const stripe = getStripe(c.env);
	const setupIntent = await createSetupIntent(stripe, user.stripe_customer_id);

	return c.json({ clientSecret: setupIntent.client_secret });
});

/**
 * Retrieves UI notifications for the current user.
 */
export const getNotifications = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const database = db(c.env.DB);

	const notifications = await database
		.select()
		.from(uiNotifications)
		.where(eq(uiNotifications.user_id, user.id))
		.orderBy(desc(uiNotifications.createdAt))
		.limit(20)
		.all();

	return c.json({ notifications });
});

/**
 * Marks all unread notifications for the user as read.
 */
export const markAllNotificationsRead = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const database = db(c.env.DB);

	await database
		.update(uiNotifications)
		.set({ is_read: true })
		.where(eq(uiNotifications.user_id, user.id));

	return c.json({ success: true });
});
