// worker/src/handlers/stripe.ts
import { Context as StripeContext } from 'hono';
import { AppEnv as StripeAppEnv } from '../index.js';
import { getStripe } from './index.js';
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
                const invoicePaid = event.data.object as Stripe.Invoice;
                console.log(`Invoice ${invoicePaid.id} was paid successfully.`);

                // Add UI notification for the customer
                const userPaid = await c.env.DB.prepare(`SELECT id FROM users WHERE stripe_customer_id = ?`).bind(invoicePaid.customer as string).first<{id: number}>();

                if (userPaid) {
                    try {
                        const message = `Payment of ${(invoicePaid.amount_paid / 100).toFixed(2)} for invoice #${invoicePaid.number} was successful.`;
                        const link = `/account`; // Link to their account/billing page
                        await c.env.DB.prepare(
                            `INSERT INTO ui_notifications (user_id, type, message, link) VALUES (?, ?, ?, ?)`
                        ).bind(userPaid.id, 'invoice_paid', message, link).run();
                    } catch (e) {
                        console.error("Failed to create UI notification for invoice.paid event", e);
                    }
                }

                // Update the job's status to 'complete'
                await c.env.DB.prepare(
                    `UPDATE jobs SET status = 'complete' WHERE stripe_invoice_id = ?`
                ).bind(invoicePaid.id).run();
                break;

            case 'invoice.created':
                const invoiceCreated = event.data.object as any;
                console.log(`Invoice ${invoiceCreated.id} was created.`);
                // If an invoice is created from a quote, we just link it.
                // We do NOT change the status here, as that is handled by the manual "Invoice Job" action.
                if (invoiceCreated.quote) {
                    await c.env.DB.prepare(
                        `UPDATE jobs SET stripe_invoice_id = ? WHERE stripe_quote_id = ?`
                    ).bind(invoiceCreated.id, invoiceCreated.quote).run();
                }
                break;

            case 'quote.accepted':
                const quoteAccepted = event.data.object as Stripe.Quote;
                console.log(`Quote ${quoteAccepted.id} was accepted.`);

                // Update job status to 'upcoming'
                const jobUpdate = await c.env.DB.prepare(
                    `UPDATE jobs SET status = 'upcoming' WHERE stripe_quote_id = ? AND status = 'pending'`
                ).bind(quoteAccepted.id).run();

                // If the status was successfully updated, notify the admins.
                if (jobUpdate.meta.changes > 0) {
                    const customer = await stripe.customers.retrieve(quoteAccepted.customer as string);
                    const customerName = (customer as Stripe.Customer).name || 'A customer';

                    const admins = await c.env.DB.prepare(
                        `SELECT id FROM users WHERE role = 'admin'`
                    ).all<{ id: number }>();

                    if (admins.results) {
                        for (const admin of admins.results) {
                            await c.env.NOTIFICATION_QUEUE.send({
                                type: 'quote_accepted',
                                user_id: admin.id,
                                data: {
                                    quoteId: quoteAccepted.id,
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
