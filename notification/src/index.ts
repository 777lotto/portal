mport {
  type Env,
  type D1Database,
  NotificationRequestSchema,
  UserSchema
} from '@portal/shared';
import { sendEmailNotification, generateEmailHTML, generateEmailText } from './email';
import { sendSMSNotification, handleSMSWebhook, getSMSConversations, getSMSConversation, generateSMSMessage } from './sms';

// Define the specific environment for this worker.
interface NotificationEnv extends Env {
    // Queues and other bindings can be added here if needed.
}

export default {
  async fetch(request: Request, env: NotificationEnv, ctx: ExecutionContext): Promise<Response> {
    const db = env.DB as D1Database;
    const url = new URL(request.url);
    const path = url.pathname;

    try {
        // Simple router
        if (path.startsWith('/api/sms/webhook')) {
            return handleSMSWebhook(request, env);
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
};

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
    const db = env.DB as D1Database;

    const user = await db.prepare(
        'SELECT id, email, name, phone FROM users WHERE id = ?'
    ).bind(userId).first<any>();

    if (!user) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
    }

    const results: Record<string, { success: boolean; error?: string }> = {};

    // Send email if requested and user has an email
    if (channels.includes('email') && user.email) {
        const subject = `Gutter Portal: ${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
        const html = generateEmailHTML(type, user.name, data);
        const text = generateEmailText(type, user.name, data);
        results.email = await sendEmailNotification(env, { to: user.email, subject, html, text });
    }

    // Send SMS if requested and user has a phone number
    if (channels.includes('sms') && user.phone) {
        const message = generateSMSMessage(type, data);
        const smsResult = await sendSMSNotification(env, user.phone, message);
        results.sms = { success: smsResult.success, error: smsResult.error };
    }

    // You could log the notification attempt to the database here

    return new Response(JSON.stringify({ success: true, results }), { headers: { 'Content-Type': 'application/json' }});
}

