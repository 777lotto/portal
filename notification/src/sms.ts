import {
  type Env,
  type D1Database,
  type SMSMessage,
  type SendSMSResult
} from '@portal/shared';

// Handles incoming SMS webhooks from VoIP.ms
export async function handleSMSWebhook(request: Request, env: Env): Promise<Response> {
    const db = env.DB as D1Database;
    const url = new URL(request.url);

    // VoIP.ms sends a GET request for its SMS callback
    const from = url.searchParams.get('from');
    const message = url.searchParams.get('message');
    const messageId = url.searchParams.get('id'); // VoIP.ms message ID

    if (!from || !message) {
        return new Response("Missing 'from' or 'message' query parameter", { status: 400 });
    }

    // Here you would find the associated user by their phone number
    // and store the incoming message in your database.
    console.log(`Received SMS from ${from} (ID: ${messageId}): "${message}"`);
    // Example DB insert:
    // const user = await db.prepare('SELECT id FROM users WHERE phone = ?').bind(from).first();
    // if (user) {
    //   await db.prepare(
    //     `INSERT INTO sms_messages (user_id, direction, message, message_sid) VALUES (?, 'incoming', ?, ?)`
    //   ).bind(user.id, message, messageId).run();
    // }

    // VoIP.ms expects a specific response format on success
    return new Response("OK");
}

// Sends an SMS notification using VoIP.ms
export async function sendSMSNotification(env: Env, to: string, message: string): Promise<SendSMSResult> {
    if (!env.VOIPMS_USERNAME || !env.VOIPMS_PASSWORD || !env.SMS_FROM_NUMBER) {
        console.warn("SMS service not configured. Missing VoIP.ms credentials or From Number.");
        return { success: false, error: "SMS service not configured." };
    }

    const endpoint = 'https://voip.ms/api/v1/rest.php';
    const params = new URLSearchParams({
        api_username: env.VOIPMS_USERNAME,
        api_password: env.VOIPMS_PASSWORD,
        method: 'sendSMS',
        did: env.SMS_FROM_NUMBER,
        dst: to,
        message: message,
    });

    try {
        const response = await fetch(`${endpoint}?${params.toString()}`);

        const result = await response.json() as any;
        if (result.status !== 'success') {
            throw new Error(result.status || 'Unknown VoIP.ms API error');
        }

        console.log(`SMS submitted to ${to}. ID: ${result.sms}`);
        return { success: true, messageSid: result.sms }; // result.sms contains the message ID
    } catch (error: any) {
        console.error("SMS sending failed via VoIP.ms:", error);
        return { success: false, error: error.message };
    }
}

// Generates the text for an SMS message
export function generateSMSMessage(type: string, data: Record<string, any>): string {
    switch(type) {
        case 'welcome':
            return `Welcome to Gutter Portal! We're glad to have you.`;
        case 'invoice_created':
            return `Gutter Portal: Your invoice for $${(data.amount / 100).toFixed(2)} is ready. Check your email to view and pay.`;
        case 'payment_reminder':
            return `Gutter Portal Reminder: Your invoice is due soon. Please check your email.`;
        default:
            return `You have a new notification from Gutter Portal.`;
    }
}

export async function getSMSConversations(env: Env, userId: string) {
    // Placeholder function to get a list of SMS conversations
    return [];
}
export async function getSMSConversation(env: Env, userId: string, phoneNumber: string) {
    // Placeholder function to get messages for a single conversation
    return [];
}
