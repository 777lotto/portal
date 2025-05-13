// notification/src/index.ts
import { Env } from '../../worker/src/env';
import { sendEmail } from './email';
import { sendSMS } from './sms';
import * as appointmentTemplate from './templates/appointment';
import * as invoiceTemplate from './templates/invoice';
import * as welcomeTemplate from './templates/welcome';
import {
  sendSMS,
  storeSMSMessage,
  handleSMSWebhook,
  getSMSConversations,
  getSMSConversation
} from './sms';


// Extend the Env interface for notification-specific environment variables
interface NotificationEnv extends Env {
  EMAIL_FROM: string;
  SMS_FROM_NUMBER: string;
  VOIPMS_USERNAME: string;
  VOIPMS_PASSWORD: string;
  PAYMENT_WORKER: Fetcher;
}

// Notification types
export const NotificationType = {
  WELCOME: 'welcome',
  APPOINTMENT_CONFIRMATION: 'appointment_confirmation',
  APPOINTMENT_REMINDER: 'appointment_reminder',
  INVOICE_CREATED: 'invoice_created',
  INVOICE_PAID: 'invoice_paid',
  INVOICE_OVERDUE: 'invoice_overdue',
} as const;

export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

// Channel types
export const ChannelType = {
  EMAIL: 'email',
  SMS: 'sms',
} as const;

export type ChannelType = typeof ChannelType[keyof typeof ChannelType];

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
        const body = await request.json();
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

        const results: Record<string, { success: boolean; error?: string }> = {};

        // Send email notification if requested
        if (channels.includes(ChannelType.EMAIL) && user.email) {
          switch (type) {
            case NotificationType.WELCOME:
              results.email = await sendEmail(env, {
                to: user.email,
                subject: 'Welcome to Portal!',
                html: welcomeTemplate.generateHtml({ name: user.name }),
                text: welcomeTemplate.generateText({ name: user.name }),
              });
              break;

            case NotificationType.APPOINTMENT_CONFIRMATION:
              results.email = await sendEmail(env, {
                to: user.email,
                subject: 'Your Appointment is Confirmed',
                html: appointmentTemplate.generateConfirmationHtml({
                  name: user.name,
                  date: data.date,
                  time: data.time,
                  serviceType: data.serviceType,
                }),
                text: appointmentTemplate.generateConfirmationText({
                  name: user.name,
                  date: data.date,
                  time: data.time,
                  serviceType: data.serviceType,
                }),
              });
              break;

            case NotificationType.APPOINTMENT_REMINDER:
              results.email = await sendEmail(env, {
                to: user.email,
                subject: 'Reminder: Upcoming Appointment',
                html: appointmentTemplate.generateReminderHtml({
                  name: user.name,
                  date: data.date,
                  time: data.time,
                  serviceType: data.serviceType,
                }),
                text: appointmentTemplate.generateReminderText({
                  name: user.name,
                  date: data.date,
                  time: data.time,
                  serviceType: data.serviceType,
                }),
              });
              break;

            case NotificationType.INVOICE_CREATED:
              results.email = await sendEmail(env, {
                to: user.email,
                subject: 'New Invoice Available',
                html: invoiceTemplate.generateInvoiceCreatedHtml({
                  name: user.name,
                  invoiceId: data.invoiceId,
                  amount: data.amount,
                  dueDate: data.dueDate,
                  invoiceUrl: data.invoiceUrl,
                }),
                text: invoiceTemplate.generateInvoiceCreatedText({
                  name: user.name,
                  invoiceId: data.invoiceId,
                  amount: data.amount,
                  dueDate: data.dueDate,
                  invoiceUrl: data.invoiceUrl,
                }),
              });
              break;

            case NotificationType.INVOICE_PAID:
              results.email = await sendEmail(env, {
                to: user.email,
                subject: 'Payment Confirmation',
                html: invoiceTemplate.generateInvoicePaidHtml({
                  name: user.name,
                  invoiceId: data.invoiceId,
                  amount: data.amount,
                  dueDate: data.dueDate,
                  invoiceUrl: data.invoiceUrl,
                }),
                text: invoiceTemplate.generateInvoicePaidText({
                  name: user.name,
                  invoiceId: data.invoiceId,
                  amount: data.amount,
                  dueDate: data.dueDate,
                  invoiceUrl: data.invoiceUrl,
                }),
              });
              break;

            default:
              results.email = {
                success: false,
                error: `Unsupported notification type: ${type}`
              };
          }
        }

        // Send SMS notification if requested
        if (channels.includes(ChannelType.SMS) && user.phone) {
          let message = '';

          switch (type) {
            case NotificationType.WELCOME:
              message = `Welcome to Portal, ${user.name}! Your account is now active.`;
              break;

            case NotificationType.APPOINTMENT_CONFIRMATION:
              message = `Hi ${user.name}, your ${data.serviceType} appointment is confirmed for ${data.date} at ${data.time}.`;
              break;

            case NotificationType.APPOINTMENT_REMINDER:
              message = `Reminder: You have a ${data.serviceType} appointment tomorrow at ${data.time}.`;
              break;

            case NotificationType.INVOICE_CREATED:
              message = `A new invoice (#${data.invoiceId}) for $${data.amount} has been created. Due: ${data.dueDate}. Log in to view details.`;
              break;

            case NotificationType.INVOICE_PAID:
              message = `Thank you! Your payment of $${data.amount} for invoice #${data.invoiceId} has been received.`;
              break;

            default:
              results.sms = {
                success: false,
                error: `Unsupported notification type: ${type}`
              };
              break;
          }

          if (message) {
            results.sms = await sendSMS(env, {
              to: user.phone,
              message
            });
          }
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

      // SMS webhook endpoint
if (path === 'sms/webhook' && request.method === 'POST') {
  return handleSMSWebhook(request, env);
}

// Send SMS endpoint
if (path === 'sms/send' && request.method === 'POST') {
  try {
    const body = await request.json();
    const { to, message, userId } = body;

    if (!to || !message) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Send the SMS
    const result = await sendSMS(env, to, message);

    // If a userId was provided, store the message
    if (userId && result.success) {
      await storeSMSMessage(
        env,
        userId,
        to,
        message,
        'outgoing',
        result.messageSid,
        'delivered'
      );
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Get SMS conversations
if (path === 'sms/conversations' && request.method === 'GET') {
  try {
    // Extract user ID from request
    const urlParams = new URLSearchParams(url.search);
    const userId = urlParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const conversations = await getSMSConversations(env, parseInt(userId, 10));

    return new Response(JSON.stringify(conversations), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Get SMS conversation messages
if (path.match(/^sms\/messages\/\+?[0-9]+$/) && request.method === 'GET') {
  try {
    // Extract phone number from path
    const phoneNumber = path.split('/').pop()!;

    // Extract user ID from request
    const urlParams = new URLSearchParams(url.search);
    const userId = urlParams.get('userId');

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const messages = await getSMSConversation(env, parseInt(userId, 10), phoneNumber);

    return new Response(JSON.stringify(messages), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

      // Default response for unknown paths
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
