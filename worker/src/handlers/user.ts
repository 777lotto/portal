// worker/src/handlers/user.ts - CORRECTED

import { createPortalSession } from '../stripe';
import { errorResponse } from '../utils';
import type { AppContext } from '../index';

export async function handlePortalSession(c: AppContext): Promise<Response> {
  const user = c.get('user');
  const env = c.env;
  try {
    // We need to fetch the latest user data to get the stripe_customer_id
    const fullUser = await env.DB.prepare("SELECT stripe_customer_id FROM users WHERE id = ?").bind(user.id).first<{stripe_customer_id: string}>();

    if (!fullUser?.stripe_customer_id) {
        return errorResponse("User does not have a Stripe customer ID.", 400);
    }
    const portalUrl = await createPortalSession(fullUser.stripe_customer_id, env);
    return c.json({ url: portalUrl });
  } catch (e: any) {
    console.error("Error creating portal session:", e);
    return errorResponse(e.message, 500);
  }
}

// Placeholder for SMS proxy, as its implementation can be complex
export async function handleSmsProxy(c: AppContext): Promise<Response> {
    console.log(`SMS proxy called for path: ${c.req.path}`);
    return c.json({ message: "SMS proxy endpoint not fully implemented." });
}
