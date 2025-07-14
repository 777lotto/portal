/* ========================================================================
                            IMPORTS & TYPES
   ======================================================================== */

import {
  type Env,
  NotificationRequestSchema,
  PushSubscriptionSchema
} from '@portal/shared';
import type { D1Database, MessageBatch } from '@cloudflare/workers-types';
import { sendEmailNotification, generateEmailHTML, generateEmailText } from './email.js';
import { sendPushNotification } from './push.js';
import {
    handleSMSWebhook,
    generateSMSMessage,
    handleGetSmsConversations,
    handleGetSmsConversation,
    handleSendSms,
    sendSMSNotification
} from './sms.js';


/* ========================================================================
                           TYPE DEFINITIONS
   ======================================================================== */

// Extends the shared Env type with bindings specific to this worker
interface NotificationEnv extends Env {
  DB: D1Database;
}


/* ========================================================================
                               API HANDLERS
   ======================================================================== */

/**
 * Provides the VAPID public key to the frontend.
 */
async function handleVapidKey(env: NotificationEnv): Promise<Response> {
    if (!env.VAPID_PUBLIC_KEY) {
        return new Response("VAPID public key not configured", { status: 500 });
    }
    return new Response(env.VAPID_PUBLIC_KEY, { headers: { 'Content-Type': 'text/plain' } });
}

/**
 * Saves a user's push notification subscription to the database.
 */
async function handleSubscribe(request: Request, env: NotificationEnv): Promise<Response> {
    const userIdHeader = request.headers.get('X-Internal-User-Id');
    if (!userIdHeader) return new Response("Unauthorized", { status: 401 });
    const userId = parseInt(userIdHeader, 10);

    const subscription = await request.json();
    const validation = PushSubscriptionSchema.safeParse(subscription);

    if (!validation.success) {
        return new Response(JSON.stringify({ error: "Invalid subscription object" }), { status: 400 });
    }

    try {
        await env.DB.prepare(
            `INSERT OR REPLACE INTO push_subscriptions (user_id, subscription_json) VALUES (?, ?)`
        ).bind(userId, JSON.stringify(subscription)).run();

        return new Response(JSON.stringify({ success: true }), { status: 201 });
    } catch (e: any) {
        console.error("Failed to save push subscription:", e);
        return new Response("Failed to save subscription", { status: 500 });
    }
}


/* ========================================================================
                             WORKER ENTRYPOINT
   ======================================================================== */

export default {
/* ========================================================================
                               FETCH HANDLER
   ======================================================================== */

  async fetch(request: Request, env: NotificationEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // --- Push Notification Routes ---
      if (path === '/api/notifications/vapid-key') {
        return handleVapidKey(env);
      }
      if (path === '/api/notifications/subscribe') {
        return handleSubscribe(request, env);
      }

      // --- SMS Routes ---
      if (path === '/api/sms/conversations') {
        return handleGetSmsConversations(request, env);
      }
      if (path.startsWith('/api/sms/conversation/')) {
        return handleGetSmsConversation(request, env);
      }
      if (path === '/api/sms/send') {
        return handleSendSms(request, env);
      }
      if (path.startsWith('/api/sms/webhook')) {
        return handleSMSWebhook(request, env);
      }

      // Fallback for unknown routes
      return new Response("Not Found in Notification Worker", { status: 404 });

    } catch (e: any) {
      console.error("Notification worker error:", e, e.stack);
      return new Response("Internal Server Error", { status: 500 });
    }
  },


/* ========================================================================
                               QUEUE HANDLER
   ======================================================================== */

  async queue(batch: MessageBatch<any>, env: NotificationEnv): Promise<void> {
    const promises = batch.messages.map(async (message) => {
      try {
        const body = message.body;
        const validation = NotificationRequestSchema.safeParse(body);

        if (!validation.success) {
          console.error('Invalid message in queue, discarding:', validation.error);
          message.ack();
          return;
        }

        const { type, userId, data, channels = ['email', 'sms'] } = validation.data;

        const user = await env.DB.prepare(
            'SELECT id, email, name, phone, email_notifications_enabled, sms_notifications_enabled FROM users WHERE id = ?'
        ).bind(userId).first<any>();

        if (!user) {
          console.error(`User with ID ${userId} not found for notification, discarding message.`);
          message.ack();
          return;
        }

        console.log(`Processing queued notification for user ${user.id}. Type: ${type}`);
        const notificationPromises = [];

        // Send email if channel is selected and user has enabled email notifications
        if (channels.includes('email') && user.email && user.email_notifications_enabled) {
          const subject = `Gutter Portal Reminder: ${type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`;
          const html = generateEmailHTML(type, user.name, data);
          const text = generateEmailText(type, user.name, data);
          notificationPromises.push(sendEmailNotification(env, { to: user.email, toName: user.name, subject, html, text }));
        }

        // Send SMS if channel is selected and user has enabled SMS notifications
        if (channels.includes('sms') && user.phone && user.sms_notifications_enabled) {
          const smsMessage = generateSMSMessage(type, data);
          notificationPromises.push(sendSMSNotification(env, user.phone, smsMessage));
        }

        // Send Push Notification if user is subscribed
        const pushSubResult = await env.DB.prepare(
            `SELECT subscription_json FROM push_subscriptions WHERE user_id = ?`
        ).bind(userId).first<{ subscription_json: string }>();

        if (pushSubResult?.subscription_json) {
            try {
                const subscription = JSON.parse(pushSubResult.subscription_json);
                const payload = JSON.stringify({
                    title: `Gutter Portal: ${type.replace(/_/g, ' ')}`,
                    body: generateSMSMessage(type, data) // Re-use SMS text for push body
                });

                notificationPromises.push(
                    sendPushNotification(env, subscription, payload)
                        .catch(async (e: any) => {
                            if (e.statusCode === 410) {
                                console.log(`Subscription for user ${userId} is expired/invalid. Deleting.`);
                                await env.DB.prepare(`DELETE FROM push_subscriptions WHERE user_id = ?`).bind(userId).run();
                            }
                        })
                );
            } catch (e) {
                console.error(`Could not parse or send push notification for user ${userId}`, e);
            }
        }

        await Promise.all(notificationPromises);
        console.log(`Successfully processed notifications for user ${userId}`);
        message.ack();

      } catch (e: any) {
        console.error('Error processing queue message:', e);
        message.retry(); // Retry the message on failure
      }
    });

    await Promise.all(promises);
  },
};
