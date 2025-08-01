import { Context as UserContext } from 'hono';
import { AppEnv as UserAppEnv } from '../index.js';
import { errorResponse as userErrorResponse, successResponse as userSuccessResponse } from '../utils.js';
import { getStripe, createStripePortalSession } from '../stripe.js';


export const handlePortalSession = async (c: UserContext<UserAppEnv>) => {
    const user = c.get('user');
    if (!user.stripe_customer_id) {
        return userErrorResponse("User is not a Stripe customer", 400);
    }
    try {
        const stripe = getStripe(c.env);
        const { PORTAL_URL } = c.env;
        const portalSession = await createStripePortalSession(stripe, user.stripe_customer_id, PORTAL_URL);
        return userSuccessResponse({ url: portalSession.url });
    } catch (e: any) {
        console.error("Portal session creation failed:", e.message);
        return userErrorResponse("Could not create customer portal session", 500);
    }
};
