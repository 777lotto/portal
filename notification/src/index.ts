// notification/src/index.ts - Minimal version to resolve build issues
import { Env } from '@portal/shared';

// Extend the Env interface for notification-specific environment variables
interface NotificationEnv extends Env {
  EMAIL_FROM: string;
  SMS_FROM_NUMBER: string;
  VOIPMS_USERNAME: string;
  VOIPMS_PASSWORD: string;
  // AWS SES credentials
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION?: string;
}

// Notification types
export const NotificationType = {
  WELCOME: 'welcome',
  APPOINTMENT_CONFIRMATION: 'appointment_confirmation',
  APPOINTMENT_REMINDER: 'appointment_reminder',
  INVOICE_CREATED: 'invoice_created',
  INVOICE_PAID: 'invoice_paid',
  INVOICE_OVERDUE: 'invoice_overdue',
  PAYMENT_REMINDER: 'payment_reminder',
} as const;

export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

// Channel types
export const ChannelType = {
  EMAIL: 'email',
  SMS: 'sms',
} as const;

export type ChannelType = typeof ChannelType[keyof typeof ChannelType];

// Simple email sending function (placeholder for SES)
async function sendEmail(env: NotificationEnv, params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ success: boolean; error?: string }> {
  // For now, just log and return success
  console.log(`Would send email to ${params.to}: ${params.subject}`);
  return { success: true };
}

// Simple SMS sending function (placeholder for VoIP.ms)
async function sendSMS(env: NotificationEnv, to: string, message: string): Promise<{ success: boolean; error?: string; messageSid?: string }> {
  // For now, just log and return success
  console.log(`Would send SMS to ${to}: ${message}`);
  return { success: true, messageSid: 'test-' + Date.now() };
}

// Handler function
export default {
  async fetch(request: Request, env: NotificationEnv): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace('/api/notifications/', '');

      // CORS handling
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      }

      // Health check endpoint
      if (path === 'ping') {
        return new Response(JSON.stringify({ status: 'ok' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Auth check
      if (!request.headers.get('Authorization')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Send notification endpoint
      if (path === 'send' && request.method === 'POST') {
        const body = await request.json() as {
          type: string;
          userId: number | string;
          data: Record<string, any>;
          channels?: string[];
        };
        
        const { type, userId, data, channels = [ChannelType.EMAIL] } = body;

        // Get user info
        const user = await env.DB.prepare(
          'SELECT id, email, name, phone FROM users WHERE id = ?'
        ).bind(userId).first();

        if (!user) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const userRecord = user as { id: number; email: string; name: string; phone?: string };
        const results: Record<string, { success: boolean; error?: string }> = {};

        // Send email notification if requested
        if (channels.includes(ChannelType.EMAIL) && userRecord.email) {
          const subject = `Notification: ${type}`;
          const html = `<p>Hello ${userRecord.name},</p><p>This is a ${type} notification.</p>`;
          const text = `Hello ${userRecord.name}, this is a ${type} notification.`;

          results.email = await sendEmail(env, {
            to: userRecord.email,
            subject,
            html,
            text,
          });
        }

        // Send SMS notification if requested
        if (channels.includes(ChannelType.SMS) && userRecord.phone) {
          const message = `Hello ${userRecord.name}, this is a ${type} notification from Portal.`;
          results.sms = await sendSMS(env, userRecord.phone, message);
        }

        // Log notification
        await env.DB.prepare(
          `INSERT INTO notifications (user_id, type, channels, status, metadata)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(
          userId,
          type,
          JSON.stringify(channels),
          Object.values(results).some(r => r.success) ? 'sent' : 'failed',
          JSON.stringify({
            sentAt: new Date().toISOString(),
            results,
            data
          })
        ).run();

        return new Response(JSON.stringify({
          success: Object.values(results).some(r => r.success),
          results
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Default response for unknown paths
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      console.error('Notification worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }, 
      });
    }
  },
};
