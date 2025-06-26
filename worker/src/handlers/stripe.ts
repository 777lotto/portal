// worker/src/handlers/stripe.ts - CORRECTED

import type { AppContext } from '../index';
import { handleStripeEvent } from '../stripe';
import { errorResponse } from '../utils';

export async function handleStripeWebhook(c: AppContext): Promise<Response> {
    const request = c.req.raw;
    const env = c.env;
    try {
        const signature = request.headers.get('stripe-signature');
        if (!signature) {
            return errorResponse("Missing Stripe signature", 400);
        }
        const body = await request.text();
        await handleStripeEvent(signature, body, env);
        return new Response(JSON.stringify({ received: true }), { status: 200 });
    } catch (err: any) {
        console.error("Stripe webhook error:", err);
        return errorResponse(err.message, 400);
    }
}
