// notification/src/sms.ts - CORRECTED
import {
  type Env,
  type SendSMSResult
} from '@portal/shared';

// FIX: Removed the unused 'env' parameter.
export async function handleSMSWebhook(request: Request): Promise<Response> {
    const url = new URL(request.url);

    const from = url.searchParams.get('from');
    const message = url.searchParams.get('message');
    const messageId = url.searchParams.get('id');

    if (!from || !message) {
        return new Response("Missing 'from' or 'message' query parameter", { status: 400 });
    }

    console.log(`Received SMS from ${from} (ID: ${messageId}): "${message}"`);

    // Here you would find the user by 'from' and store the 'message' in your database.

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
        return { success: true, messageSid: result.sms };
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
