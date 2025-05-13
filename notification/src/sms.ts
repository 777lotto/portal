// notification/src/sms.ts
import { Env } from '../../worker/src/env';
import { SMSMessage, SMSWebhookRequest } from './types';

// Send SMS using VoIP.ms
export async function sendSMS(
  env: Env,
  to: string,
  message: string
): Promise<{ success: boolean; error?: string; messageSid?: string }> {
  try {
    const from = env.SMS_FROM_NUMBER;

    // Build VoIP.ms API URL
    const voipmsUrl = new URL('https://voip.ms/api/v1/rest.php');
    voipmsUrl.searchParams.append('api_username', env.VOIPMS_USERNAME);
    voipmsUrl.searchParams.append('api_password', env.VOIPMS_PASSWORD);
    voipmsUrl.searchParams.append('method', 'sendSMS');
    voipmsUrl.searchParams.append('did', from);
    voipmsUrl.searchParams.append('dst', to);
    voipmsUrl.searchParams.append('message', message);

    const response = await fetch(voipmsUrl.toString(), {
      method: 'GET',
    });

    const result = await response.json();

    // VoIP.ms responds with { status: 'success', sms: [{ id: '123456' }] } on success
    if (result.status === 'success' && result.sms && result.sms.length > 0) {
      const messageSid = result.sms[0].id;
      return { success: true, messageSid };
    } else {
      console.error('SMS sending failed:', result.status);
      return { success: false, error: result.status };
    }
  } catch (error) {
    console.error('SMS sending error:', error);
    return { success: false, error: error.message };
  }
}

// Store SMS message in the database
export async function storeSMSMessage(
  env: Env,
  userId: number | string,
  phoneNumber: string,
  message: string,
  direction: 'incoming' | 'outgoing',
  messageSid?: string,
  status: 'pending' | 'delivered' | 'failed' = 'delivered'
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO sms_messages (user_id, direction, phone_number, message, message_sid, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(userId, direction, phoneNumber, message, messageSid || null, status).run();
}

// Process incoming SMS webhook
export async function handleSMSWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // Parse form data from VoIP.ms webhook
    const formData = await request.formData();

    const payload: SMSWebhookRequest = {
      from: formData.get('from') as string,
      to: formData.get('to') as string,  // Your VoIP.ms DID number
      message: formData.get('message') as string,
      id: formData.get('id') as string,
    };

    if (!payload.from || !payload.message) {
      return new Response(JSON.stringify({ error: "Missing required parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`Received SMS from ${payload.from}: ${payload.message}`);

    // Find the user associated with this phone number
    const user = await env.DB.prepare(
      `SELECT id, name, email FROM users WHERE phone = ?`
    ).bind(payload.from).first();

    const userId = user ? user.id : 0;  // Use 0 for unassigned messages

    // Store the message
    await storeSMSMessage(
      env,
      userId,
      payload.from,
      payload.message,
      'incoming',
      payload.id
    );

    // Process the incoming message
    if (user) {
      await processIncomingSMS(env, user, payload);
    } else {
      // Handle unknown sender
      const responseMessage = "Sorry, we couldn't identify your account. Please call our office for assistance.";

      await sendSMS(env, payload.from, responseMessage);
      // Store the response
      await storeSMSMessage(env, 0, payload.from, responseMessage, 'outgoing');
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("SMS webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Process incoming SMS based on content
async function processIncomingSMS(
  env: Env,
  user: { id: number | string; name: string; email: string },
  payload: SMSWebhookRequest
): Promise<void> {
  // Convert message to lowercase for easier matching
  const normalizedMessage = payload.message.trim().toLowerCase();

  // Check for keywords and determine response
  let responseMessage: string;

  if (normalizedMessage === 'confirm' || normalizedMessage === 'yes') {
    // Look for upcoming appointments
    const upcomingService = await env.DB.prepare(
      `SELECT id FROM services
       WHERE user_id = ? AND status = 'upcoming'
       ORDER BY service_date ASC LIMIT 1`
    ).bind(user.id).first();

    if (upcomingService) {
      // Update service status to confirmed
      await env.DB.prepare(
        `UPDATE services SET status = 'confirmed' WHERE id = ?`
      ).bind(upcomingService.id).run();

      responseMessage = "Thank you for confirming your appointment. We look forward to serving you!";
    } else {
      responseMessage = "We don't see any upcoming appointments to confirm. Please call our office for assistance.";
    }
  }
  else if (normalizedMessage === 'reschedule' || normalizedMessage.includes('reschedule')) {
    responseMessage = "To reschedule your appointment, please call our office at (555) 123-4567 or visit your customer portal.";
  }
  else if (normalizedMessage === 'cancel' || normalizedMessage.includes('cancel')) {
    responseMessage = "To cancel your appointment, please call our office at (555) 123-4567. Please note our 24-hour cancellation policy.";
  }
  else if (normalizedMessage === 'pay' || normalizedMessage.includes('pay')) {
    // Find any outstanding invoices
    const invoice = await env.DB.prepare(
      `SELECT s.id, s.price_cents, s.stripe_invoice_id
       FROM services s
       WHERE s.user_id = ? AND s.status = 'invoiced'
       ORDER BY s.service_date DESC LIMIT 1`
    ).bind(user.id).first();

    if (invoice) {
      const amountFormatted = (invoice.price_cents / 100).toFixed(2);
      const paymentLink = `https://portal.777.foo/services/${invoice.id}`;
      responseMessage = `You can pay your invoice of $${amountFormatted} here: ${paymentLink}`;
    } else {
      responseMessage = "We don't see any outstanding invoices for your account. If you believe this is an error, please contact our office.";
    }
  }
  else {
    // Default response for unrecognized messages
    responseMessage = "Thank you for your message. If you need assistance, please call our office at (555) 123-4567 or visit your customer portal.";
  }

  // Send the response
  const result = await sendSMS(env, payload.from, responseMessage);

  // Store the outgoing message
  await storeSMSMessage(
    env,
    user.id,
    payload.from,
    responseMessage,
    'outgoing',
    result.messageSid,
    result.success ? 'delivered' : 'failed'
  );
}

// Get SMS conversations for a user
export async function getSMSConversations(
  env: Env,
  userId: number | string
): Promise<any[]> {
  const { results } = await env.DB.prepare(
    `SELECT phone_number,
            MAX(created_at) as last_message_at,
            COUNT(*) as message_count
     FROM sms_messages
     WHERE user_id = ?
     GROUP BY phone_number
     ORDER BY last_message_at DESC
     LIMIT 20`
  ).bind(userId).all();

  return results;
}

// Get SMS messages for a specific conversation
export async function getSMSConversation(
  env: Env,
  userId: number | string,
  phoneNumber: string
): Promise<SMSMessage[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, direction, message, created_at, status, message_sid
     FROM sms_messages
     WHERE user_id = ? AND phone_number = ?
     ORDER BY created_at DESC
     LIMIT 100`
  ).bind(userId, phoneNumber).all();

  return results as SMSMessage[];
}
