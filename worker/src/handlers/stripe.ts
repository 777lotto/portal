// worker/src/handlers/stripe.ts
// --------------------------------------
import { Context as StripeContext } from 'hono';
import { AppEnv as StripeAppEnv } from '../index.js';
import { getStripe } from '../stripe.js';
import Stripe from 'stripe';

export const handleStripeWebhook = async (c: StripeContext<StripeAppEnv>) => {
    const stripe = getStripe(c.env);
    const signature = c.req.header('stripe-signature');
    if (!signature) {
        return new Response("Webhook Error: No signature provided", { status: 400 });
    }

    try {
        const body = await c.req.text();
        const event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            c.env.STRIPE_WEBHOOK_SECRET
        );

        // Handle the event
        switch (event.type) {
            case 'invoice.paid':
                const invoice = event.data.object as Stripe.Invoice;
                console.log(`Invoice ${invoice.id} was paid successfully.`);
                // Here you would update the service status in your DB
                await c.env.DB.prepare(
                    `UPDATE services SET status = 'paid' WHERE stripe_invoice_id = ?`
                ).bind(invoice.id).run();
                break;
            // ... handle other event types
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return new Response(JSON.stringify({ received: true }), { status: 200 });
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
};
