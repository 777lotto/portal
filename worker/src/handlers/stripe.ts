// worker/src/handlers/stripe.ts
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

                // Add UI notification for the customer
                const user = await c.env.DB.prepare(`SELECT id FROM users WHERE stripe_customer_id = ?`).bind(invoice.customer as string).first<{id: number}>();

                if (user) {
                    try {
                        const message = `Payment of $${(invoice.amount_paid / 100).toFixed(2)} for invoice #${invoice.number} was successful.`;
                        const link = `/account`; // Link to their account/billing page
                        // NOTE: This assumes a 'ui_notifications' table exists.
                        await c.env.DB.prepare(
                            `INSERT INTO ui_notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)`
                        ).bind(user.id, 'invoice_paid', message, link).run();
                    } catch (e) {
                        console.error("Failed to create UI notification for invoice.paid event", e);
                        // Do not block the main flow if UI notification fails
                    }
                }

                // Update the job's status to 'paid'
                await c.env.DB.prepare(
                    `UPDATE jobs SET status = 'paid' WHERE stripe_invoice_id = ?`
                ).bind(invoice.id).run();
                break;

            // --- NEW WEBHOOK HANDLER FOR QUOTES ---
            case 'quote.finalized':
                const quote = event.data.object as Stripe.Quote;
                console.log(`Quote ${quote.id} was finalized.`);

                // Retrieve the customer to get their name
                const customer = await stripe.customers.retrieve(quote.customer as string);
                const customerName = (customer as Stripe.Customer).name || 'A customer';

                // Update job status to 'quote_accepted'
                const jobUpdate = await c.env.DB.prepare(
                    `UPDATE jobs SET status = 'quote_accepted' WHERE stripe_quote_id = ?`
                ).bind(quote.id).run();

                // Notify admin that quote was accepted
                if (jobUpdate.meta.changes > 0) {
                    const admins = await c.env.DB.prepare(
                        `SELECT id FROM users WHERE role = 'admin'`
                    ).all<{ id: number }>();

                    if (admins.results) {
                        for (const admin of admins.results) {
                            await c.env.NOTIFICATION_QUEUE.send({
                                type: 'quote_accepted',
                                userId: admin.id,
                                data: {
                                    quoteId: quote.id,
                                    customerName: customerName
                                },
                                channels: ['email']
                            });
                        }
                    }
                }
                break;

            case 'billing_portal.session.created':
                const session = event.data.object as Stripe.BillingPortal.Session;
                console.log(`Stripe billing portal session ${session.id} was created for customer ${session.customer}. No action taken.`);
                break;

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return new Response(JSON.stringify({ received: true }), { status: 200 });
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
};
