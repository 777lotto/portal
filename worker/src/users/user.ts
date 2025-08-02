import { createFactory } from 'hono/factory';
import { clerkAuth, getAuth } from '@hono/clerk-auth';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { getStripe, createStripePortalSession } from '../../stripe';

const factory = createFactory();

export const createPortalSession = factory.createHandlers(clerkAuth, async (c) => {
	const auth = getAuth(c);
	if (!auth?.userId) {
		throw new HTTPException(401, { message: 'Unauthorized' });
	}

	const database = db(c.env.DB);
	const user = await database.select().from(users).where(eq(users.clerk_id, auth.userId)).get();

	if (!user?.stripe_customer_id) {
		throw new HTTPException(400, { message: 'User is not a Stripe customer or does not exist.' });
	}

	try {
		const stripe = getStripe(c.env);
		const { PORTAL_URL } = c.env;
		const portalSession = await createStripePortalSession(stripe, user.stripe_customer_id, PORTAL_URL);

		// This response is a redirect URL, so wrapping it is conventional.
		return c.json({ url: portalSession.url });
	} catch (e: any) {
		console.error('Portal session creation failed:', e.message);
		throw new HTTPException(500, { message: 'Could not create customer portal session.' });
	}
});
