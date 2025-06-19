// payment/src/index.ts - Fixed with proper environment interface
import { type BaseEnv, SendReminderSchema } from '@portal/shared';

// Payment-specific environment interface
interface PaymentEnv extends BaseEnv {
  // Service bindings
  NOTIFICATION_WORKER?: { fetch: (request: Request) => Promise<Response> };
  
  // Environment variables
  ENVIRONMENT?: string;
}

// Payment service types
export const PaymentActionType = {
  SEND_REMINDER: 'send_reminder',
  PROCESS_PAYMENT: 'process_payment',
  CHECK_STATUS: 'check_status',
} as const;

export type PaymentActionType = typeof PaymentActionType[keyof typeof PaymentActionType];

// Handler function
export default {
  async fetch(request: Request, env: PaymentEnv): Promise<Response> {
    try {
      const url = new URL(request.url);
      const path = url.pathname.replace('/api/payment/', '');

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

      // Auth check (validate request is coming from our main worker)
      if (!request.headers.get('Authorization')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Send payment reminder endpoint
      if (path === 'send-reminder' && request.method === 'POST') {
        const body = await request.json();

        // Validate with Zod
        const validationResult = SendReminderSchema.safeParse(body);
        if (!validationResult.success) {
          return new Response(JSON.stringify({
            error: 'Invalid request body',
            details: validationResult.error.flatten()
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const { serviceId } = validationResult.data;
        const result = await sendPaymentReminder(env, serviceId);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Run payment reminders endpoint (bulk processing)
      if (path === 'run-reminders' && request.method === 'POST') {
        const result = await runPaymentReminders(env);

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Default response for unknown paths
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },

  // Add support for scheduled jobs (cron)
  async scheduled(event: ScheduledEvent, env: PaymentEnv, ctx: ExecutionContext) {
    console.log("Running scheduled payment job:", event.cron);

    // Run payment reminders
    ctx.waitUntil(runPaymentReminders(env));
  },
};

// Send a payment reminder for an unpaid invoice
async function sendPaymentReminder(
  env: PaymentEnv,
  serviceId: number
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    // Get service details and user contact info
    const service = await env.DB.prepare(
      `SELECT s.id, s.user_id, s.service_date, s.status, s.price_cents, s.stripe_invoice_id,
              u.name, u.phone, u.email, u.stripe_customer_id
       FROM services s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ? AND s.status = 'invoiced'`
    ).bind(serviceId).first();

    if (!service) {
      return { success: false, error: "Service not found or not invoiced" };
    }

    const serviceRecord = service as {
      id: number;
      user_id: number;
      service_date: string;
      status: string;
      price_cents?: number;
      stripe_invoice_id?: string;
      name: string;
      phone?: string;
      email?: string;
      stripe_customer_id?: string;
    };

    if (!serviceRecord.phone) {
      return { success: false, error: "User has no phone number" };
    }

    // Check if we've already sent reminders
    let reminder = await env.DB.prepare(
      `SELECT * FROM payment_reminders WHERE service_id = ?`
    ).bind(serviceId).first();

    // If no reminder record exists, create one
    if (!reminder) {
      await env.DB.prepare(
        `INSERT INTO payment_reminders (service_id, status)
         VALUES (?, 'pending')`
      ).bind(serviceId).run();

      reminder = {
        id: 0,  // placeholder
        service_id: serviceId,
        reminder_count: 0,
        status: 'pending'
      };
    }

    const reminderRecord = reminder as {
      id: number;
      service_id: number;
      reminder_count: number;
      status: string;
    };

    // Format the amount for display
    const amountFormatted = ((serviceRecord.price_cents || 0) / 100).toFixed(2);

    // Create payment link
    const paymentLink = `https://portal.777.foo/services/${serviceId}`;

    // Customize message based on reminder count
    let message: string;

    if (reminderRecord.reminder_count === 0) {
      // First reminder
      message = `Hi ${serviceRecord.name}, this is a friendly reminder that your invoice for $${amountFormatted} is due. You can pay online here: ${paymentLink} or reply PAY to get payment assistance.`;
    }
    else if (reminderRecord.reminder_count === 1) {
      // Second reminder
      message = `Hi ${serviceRecord.name}, your invoice for $${amountFormatted} is now past due. Please pay online at ${paymentLink} or reply PAY for payment options.`;
    }
    else {
      // Final reminder
      message = `FINAL NOTICE: Your invoice for $${amountFormatted} requires immediate attention. Please pay now at ${paymentLink} to avoid additional fees. Reply PAY for assistance.`;
    }

    // Send the SMS via the notification worker if available
    if (env.NOTIFICATION_WORKER) {
      const notificationResult = await env.NOTIFICATION_WORKER.fetch(
        new Request('https://portal.777.foo/api/notifications/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer payment-worker-internal',
          },
          body: JSON.stringify({
            type: 'payment_reminder',
            userId: serviceRecord.user_id,
            data: {
              invoiceId: serviceRecord.id.toString(),
              amount: amountFormatted,
              paymentLink: paymentLink
            },
            channels: ['sms']
          })
        })
      );

      if (!notificationResult.ok) {
        const error = await notificationResult.text();
        return { success: false, error };
      }
    }

    // Update reminder record
    const now = new Date().toISOString();
    const nextReminder = new Date();
    nextReminder.setDate(nextReminder.getDate() + 3); // Schedule next reminder in 3 days

    await env.DB.prepare(
      `UPDATE payment_reminders
       SET reminder_count = reminder_count + 1,
           last_sent_at = ?,
           next_scheduled_at = ?,
           status = 'sent'
       WHERE service_id = ?`
    ).bind(now, nextReminder.toISOString(), serviceId).run();

    return { success: true };
  } catch (error: any) {
    console.error("Payment reminder error:", error);
    return { success: false, error: error.message };
  }
}

// Run payment reminders for all eligible invoices
async function runPaymentReminders(env: PaymentEnv): Promise<{ success: boolean; count: number }> {
  try {
    // Get all services that are invoiced but not paid
    const { results: services } = await env.DB.prepare(
      `SELECT s.id, s.user_id, s.service_date, s.status, s.price_cents
       FROM services s
       LEFT JOIN payment_reminders pr ON s.id = pr.service_id
       WHERE s.status = 'invoiced'
       AND (
           pr.id IS NULL OR
           (pr.status = 'sent' AND pr.next_scheduled_at <= datetime('now') AND pr.reminder_count < 3)
       )`
    ).all();

    console.log(`Found ${(services || []).length} services needing payment reminders`);

    // Send reminders for each service
    let successCount = 0;
    for (const service of (services || [])) {
      const serviceRecord = service as { id: number };
      const result = await sendPaymentReminder(env, serviceRecord.id);
      if (result.success) {
        successCount++;
      }
    }

    return { success: true, count: successCount };
  } catch (error: any) {
    console.error("Run payment reminders error:", error);
    return { success: false, count: 0 };
  }
}

// Mark a payment reminder as paid when the invoice is paid
export async function markPaymentReminderPaid(env: PaymentEnv, serviceId: number): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE payment_reminders
       SET status = 'paid'
       WHERE service_id = ?`
    ).bind(serviceId).run();
  } catch (error: any) {
    console.error("Mark payment reminder paid error:", error);
  }
}
