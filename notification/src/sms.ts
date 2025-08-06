// notification/src/sms.ts - CORRECTED
import {
  type Env,
  type SendSMSResult,
  type SMSMessage,
  type Conversation,
  type User,
} from '@portal/shared';
import { z } from 'zod';
import type { D1Database } from '@cloudflare/workers-types';

// --- Type Definitions & Schemas ---

interface NotificationEnv extends Env {
    DB: D1Database;
}

const SendSmsPayloadSchema = z.object({
  to: z.string().min(10),
  message: z.string().min(1),
});


// --- Helper Functions ---

function jsonResponse(data: any, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function getUserId(request: Request): number | null {
    const userIdHeader = request.headers.get('X-Internal-User-Id');
    if (!userIdHeader) return null;
    const id = parseInt(userIdHeader, 10);
    return isNaN(id) ? null : id;
}


// --- Route Handlers ---

export async function handleSMSWebhook(request: Request, env: NotificationEnv): Promise<Response> {
    const url = new URL(request.url);
    const from = url.searchParams.get('from');
    const message = url.searchParams.get('message');
    const messageId = url.searchParams.get('id');

    if (!from || !message) {
        return new Response("Missing 'from' or 'message' query parameter", { status: 400 });
    }

    try {
        const user = await env.DB.prepare(`SELECT id FROM users WHERE phone = ?`).bind(from).first<User>();
        if (!user) {
            console.error(`Received SMS from unknown number: ${from}`);
            return new Response("User not found", { status: 404 });
        }

        await env.DB.prepare(
            `INSERT INTO sms_messages (user_id, direction, phone_number, message, message_sid, status) VALUES (?, 'incoming', ?, ?, ?, 'delivered')`
        ).bind(user.id, from, message, messageId).run();

        console.log(`Received and stored SMS from ${from} for user ${user.id}`);
        return new Response("OK");

    } catch (e: any) {
        console.error("Error in SMS webhook:", e);
        return new Response("Internal Server Error", { status: 500 });
    }
}

export async function handleGetSmsConversations(request: Request, env: NotificationEnv): Promise<Response> {
    const userId = getUserId(request);
    const userRole = request.headers.get('X-Internal-User-Role');

    if (!userId) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    try {
        let query;
        if (userRole === 'admin') {
            query = env.DB.prepare(`
                SELECT phone_number, COUNT(*) as message_count, MAX(created_at) as last_message_at
                FROM sms_messages
                GROUP BY phone_number
                ORDER BY last_message_at DESC
            `);
        } else {
            query = env.DB.prepare(`
                SELECT phone_number, COUNT(*) as message_count, MAX(created_at) as last_message_at
                FROM sms_messages
                WHERE user_id = ?
                GROUP BY phone_number
                ORDER BY last_message_at DESC
            `).bind(userId);
        }

        const { results } = await query.all<Conversation>();
        return jsonResponse(results || []);

    } catch (e: any) {
        console.error("Failed to get SMS conversations:", e);
        return jsonResponse({ error: "Failed to retrieve conversations" }, 500);
    }
}

export async function handleGetSmsConversation(request: Request, env: NotificationEnv): Promise<Response> {
    const userId = getUserId(request);
    if (!userId) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const url = new URL(request.url);
    const phoneNumber = url.pathname.split('/').pop();
    if (!phoneNumber) {
        return jsonResponse({ error: "Phone number is required" }, 400);
    }

    try {
        const { results } = await env.DB.prepare(
            `SELECT * FROM sms_messages WHERE phone_number = ? ORDER BY created_at ASC`
        ).bind(phoneNumber).all<SMSMessage>();

        return jsonResponse(results || []);
    } catch (e: any) {
        console.error(`Failed to get messages for ${phoneNumber}:`, e);
        return jsonResponse({ error: "Failed to retrieve messages" }, 500);
    }
}

export async function handleSendSms(request: Request, env: NotificationEnv): Promise<Response> {
    const userId = getUserId(request);
    if (!userId) {
        return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await request.json();
    const parsed = SendSmsPayloadSchema.safeParse(body);

    if (!parsed.success) {
        return jsonResponse({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
    }

    const { to, message } = parsed.data;
    const sendResult = await sendSMSNotification(env, to, message);
    if (!sendResult.success) {
        return jsonResponse({ error: sendResult.error || "Failed to send SMS" }, 500);
    }

    try {
        const { results } = await env.DB.prepare(
            `INSERT INTO sms_messages (user_id, direction, phone_number, message, message_sid, status)
             VALUES (?, 'outgoing', ?, ?, ?, 'sent') RETURNING *`
        ).bind(userId, to, message, sendResult.messageSid).all<SMSMessage>();

        if (!results || results.length === 0) {
            throw new Error("Failed to retrieve sent message from DB.");
        }

        return jsonResponse(results[0], 201);

    } catch (e: any) {
        console.error("Failed to store outgoing SMS:", e);
        return jsonResponse({ error: "Message sent but failed to record in history" }, 500);
    }
}


// --- Core Functions ---

export async function sendSMSNotification(env: Env, to: string, message: string): Promise<SendSMSResult> {
    if (!env.VOIPMS_USERNAME || !env.VOIPMS_PASSWORD || !env.SMS_FROM_NUMBER) {
        console.warn("SMS service not configured. Missing VoIP.ms credentials or From Number.");
        return { success: false, error: "SMS service not configured." };
    }

    const cleanedTo = to.replace(/\D/g, '').slice(-10);

    if (cleanedTo.length !== 10) {
        const errorMsg = `Invalid phone number format after cleaning: ${to}`;
        console.error(errorMsg);
        return { success: false, error: errorMsg };
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

// UPDATED: Added a case for password resets and other templates
export function generateSMSMessage(type: string, data: Record<string, any>): string {
    switch(type) {
        case 'welcome':
            return `Welcome to Gutter Portal! We're glad to have you. Manage your services at ${data.portalUrl || 'https://portal.777.foo'}`;
        case 'password_reset':
            return `Your 777 Portal verification code is: ${data.resetCode}. It will expire in 10 minutes.`;
        case 'invoice_created':
            return `Gutter Portal: Your invoice for $${(data.amount / 100).toFixed(2)} is ready. Check your email to view and pay.`;
        case 'invoice_reminder':
            return `Gutter Portal Reminder: Your invoice is due soon. Please check your email to pay.`;
        case 'invoice_past_due':
            return `Gutter Portal Reminder: Your invoice #${data.invoiceId} is past due. Please check your email to pay now and avoid service interruptions.`;
        case 'service_reminder':
            const serviceDate = new Date(data.serviceDate).toLocaleDateString();
            return `Gutter Portal Reminder: You have a service appointment for "${data.serviceType}" scheduled for tomorrow, ${serviceDate}.`;
        default:
            return `You have a new notification from Gutter Portal.`;
    }
}
