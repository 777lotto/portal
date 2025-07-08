// notification/src/index.ts - UPDATED

import {
  type Env,
  NotificationRequestSchema,
} from '@portal/shared';
import { sendEmailNotification, generateEmailHTML, generateEmailText } from './email.js';
import {
    handleSMSWebhook,
    generateSMSMessage,
    handleGetSmsConversations,
    handleGetSmsConversation,
    handleSendSms,
    // ADDED: Statically import the sender function
    sendSMSNotification
} from './sms.js';
import type { D1Database, MessageBatch } from '@cloudflare/workers-types';

// Define the environment interface for this worker
interface NotificationEnv extends Env {
  DB: D1Database;
}

// --- Notification Sending Logic (API-based for immediate sends) ---

async function handleSendNotification(request: Request, env: NotificationEnv): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const body = await request.json();
    const validation = NotificationRequestSchema.safeParse(body);

    if (!validation.success) {
        return new Response(JSON.stringify({ error: 'Invalid request body', details: validation.error.flatten() }), { status: 400, headers: { 'Content-Type': 'application/json' }});
    }

    const { type, userId, data, channels = ['email'] } = validation.data;
    const db = env.DB;

    const user = await db.prepare(
        'SELECT id, email, name, phone FROM users WHERE id = ?'
    ).bind(userId).first<any>();

    if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    const results: Record<string, { success: boolean; error?: string }> = {};

    if (channels.includes('email') && user.email) {
        const subject = `Gutter Portal: ${type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}`;
        const html = generateEmailHTML(type, user.name, data);
        const text = generateEmailText(type, user.name, data);
        results.email = await sendEmailNotification(env, { to: user.email, toName: user.name, subject, html, text });
    }

    if (channels.includes('sms') && user.phone) {
        const message = generateSMSMessage(type, data);
        const smsResult = await sendSMSNotification(env, user.phone, message);
        results.sms = { success: smsResult.success, error: smsResult.error };
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { 'Content-Type': 'application/json' }});
}


// --- Worker Entry Point ---

export default {
  async fetch(request: Request, env: NotificationEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
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

      // --- Automated Notification Route ---
      if (path.startsWith('/api/notifications/send')) {
        return handleSendNotification(request, env);
      }

      // Fallback for unknown routes
      return new Response("Not Found in Notification Worker", { status: 404 });

    } catch (e: any) {
      console.error("Notification worker error:", e, e.stack);
      return new Response("Internal Server Error", { status: 500 });
    }
  },

  // FIXED: Implemented the queue handler logic
  async queue(
    batch: MessageBatch<any>,
    env: NotificationEnv
  ): Promise<void> {
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
            'SELECT id, email, name, phone FROM users WHERE id = ?'
        ).bind(userId).first<any>();

        if (!user) {
          console.error(`User with ID ${userId} not found for notification, discarding message.`);
          message.ack();
          return;
        }

        console.log(`Processing queued notification for user ${user.id}. Type: ${type}`);
        const notificationPromises = [];

        // Send email if channel is selected and user has an email
        if (channels.includes('email') && user.email) {
          const subject = `Gutter Portal Reminder: ${type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}`;
          const html = generateEmailHTML(type, user.name, data);
          const text = generateEmailText(type, user.name, data);
          notificationPromises.push(sendEmailNotification(env, { to: user.email, toName: user.name, subject, html, text }));
        }

        // Send SMS if channel is selected and user has a phone number
        if (channels.includes('sms') && user.phone) {
          const smsMessage = generateSMSMessage(type, data);
          notificationPromises.push(sendSMSNotification(env, user.phone, smsMessage));
        }

        await Promise.all(notificationPromises);
        console.log(`Successfully sent notifications for user ${userId}`);
        message.ack();

      } catch (e: any) {
        console.error('Error processing queue message:', e);
        message.retry(); // Retry the message on failure
      }
    });

    await Promise.all(promises);
  },
};
