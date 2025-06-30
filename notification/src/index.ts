// notification/src/index.ts

import {
  type Env,
  NotificationRequestSchema,
} from '@portal/shared';
import { sendEmailNotification, generateEmailHTML, generateEmailText } from './email.js';
import { sendSMSNotification, handleSMSWebhook, generateSMSMessage } from './sms.js';
import type { D1Database } from '@cloudflare/workers-types';

interface NotificationEnv extends Env {
  DB: D1Database;
}

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
        results.email = await sendEmailNotification(env, { to: user.email, subject, html, text });
    }

    if (channels.includes('sms') && user.phone) {
        const message = generateSMSMessage(type, data);
        const smsResult = await sendSMSNotification(env, user.phone, message);
        results.sms = { success: smsResult.success, error: smsResult.error };
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { 'Content-Type': 'application/json' }});
}

export default {
  async fetch(request: Request, env: NotificationEnv): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path.startsWith('/api/sms/webhook')) {
        return handleSMSWebhook(request);
      }

      if (path.startsWith('/api/notifications/send')) {
        return handleSendNotification(request, env);
      }

      return new Response("Not Found", { status: 404 });

    } catch (e: any) {
      console.error("Notification worker error:", e);
      return new Response("Internal Server Error", { status: 500 });
    }
  },

  async queue(
    batch: MessageBatch<any>
    // env parameter removed since it was unused
  ): Promise<void> {
    for (const message of batch.messages) {
      console.log(`Received message in notification queue: ${message.id}`);
      //
      // In a real application, you would add logic here to process the message.
      // For example, you could send an email or SMS notification.
      //
      message.ack();
    }
  },
};
