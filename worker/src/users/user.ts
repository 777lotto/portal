import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../db/client.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getStripe, createStripePortalSession } from '../stripe/index.js';
import type { AppEnv } from '../server.js';

const factory = createFactory<AppEnv>();

/**
 * Creates a Stripe Customer Portal session.
 * This allows a logged-in user to manage their billing details directly with Stripe.
 *
 * REFACTORED: The try/catch block has been removed. Any errors from Stripe
 * will be caught by the global `onError` handler, simplifying the code here.
 */
export const createPortalSession = factory.createHandlers(async (c) => {
	const auth = getAuth(c);
	if (!auth?.userId) {
		throw new HTTPException(401, { message: 'Unauthorized' });
	}

	const database = db(c.env.DB);
	const user = await database.select().from(schema.users).where(eq(schema.users.clerk_id, auth.userId)).get();

	if (!user?.stripe_customer_id) {
		throw new HTTPException(400, { message: 'User is not a Stripe customer or does not exist.' });
	}

	const stripe = getStripe(c.env);
	const { PORTAL_URL } = c.env;

	// This function call can now throw an error that will be handled globally.
	const portalSession = await createStripePortalSession(stripe, user.stripe_customer_id, PORTAL_URL);

	// The response is already in a consistent "envelope" format.
	return c.json({ url: portalSession.url });
});
