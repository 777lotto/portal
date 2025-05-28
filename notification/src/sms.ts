// notification/src/sms.ts - Simplified and fixed

interface NotificationEnv {
  SMS_FROM_NUMBER: string;
  VOIPMS_USERNAME?: string;
  VOIPMS_PASSWORD?: string;
  DB: D1Database;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta: any;
}

interface SMSMessage {
  id: number;
  user_id: number | string;
  direction: 'incoming' | 'outgoing';
  phone_number: string;
  message: string;
  message_sid?: string;
  status: 'pending' | 'delivered' | 'failed';
  created_at: string;
}

interface SMSWebhookRequest {
  from: string;
  to: string;
  message: string;
  id?: string;
}

interface SendSMSResult {
  success: boolean;
  error?: string;
  messageSid?: string;
}

// Send SMS using VoIP.ms with better error handling
export async function sendSMS(
  env: NotificationEnv,
  to: string,
  message: string
): Promise<SendSMSResult> {
  try {
    // Validate credentials
    if (!env.VOIPMS_USERNAME || !env.VOIPMS_PASSWORD) {
      throw new Error('VoIP.ms credentials not configured');
    }

    // Validate parameters
    if (!to || !message) {
      throw new Error('Missing required parameters: to and message');
    }

    // Clean phone number (remove non-digits)
    const cleanTo = to.replace(/\D/g, '');
    if (cleanTo.length < 10) {
      throw new Error('Invalid phone number format');
    }

    const from = env.SMS_FROM_NUMBER;

    // Build VoIP.ms API URL with proper encoding
    const voipmsUrl = new URL('https://voip.ms/api/v1/rest.php');
    voipmsUrl.searchParams.append('api_username', env.VOIPMS_USERNAME);
    voipmsUrl.searchParams.append('api_password', env.VOIPMS_PASSWORD);
    voipmsUrl.searchParams.append('method', 'sendSMS');
    voipmsUrl.searchParams.append('did', from);
    voipmsUrl.searchParams.append('dst', cleanTo);
    voipmsUrl.searchParams.append('message', message.substring(0, 160)); // Limit SMS length

    console.log('Sending SMS via VoIP.ms to:', cleanTo);

    const response = await fetch(voipmsUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'GutterPortal/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`VoIP.ms API request failed: ${response.status}`);
    }

    const result = await response.json() as {
      status: string;
      sms?: Array<{ id: string }>;
    };

    // VoIP.ms responds with { status: 'success', sms: [{ id: '123456' }] } on success
    if (result.status === 'success' && result.sms && result.sms.length > 0) {
      const messageSid = result.sms[0].id;
      console.log('SMS sent successfully, ID:', messageSid);
      return { success: true, messageSid };
    } else {
      console.error('SMS sending failed:', result.status);
      return { success: false, error: result.status || 'Unknown error' };
    }
  } catch (error: any) {
    console.error('SMS sending error:', error);
    return { success: false, error: error.message || 'SMS sending failed' };
  }
}

// Store SMS message in the database
export async function storeSMSMessage(
  env: NotificationEnv,
  userId: number | string,
  phoneNumber: string,
  message: string,
  direction: 'incoming' | 'outgoing',
  messageSid?: string,
  status: 'pending' | 'delivered' | 'failed' = 'delivered'
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO sms_messages (user_id, direction, phone_number, message, message_sid, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(userId, direction, phoneNumber, message, messageSid || null, status).run();
  } catch (error) {
    console.error('Failed to store SMS message:', error);
    // Don't throw - this shouldn't fail the SMS sending
  }
}

// Simple SMS webhook handler (placeholder)
export async function handleSMSWebhook(
  request: Request,
  env: NotificationEnv
): Promise<Response> {
  try {
    console.log('SMS webhook received');
    
    // For now, just return success
    // In a real implementation, you'd parse the webhook data and process it
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("SMS webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Get SMS conversations for a user
export async function getSMSConversations(
  env: NotificationEnv,
  userId: number | string
): Promise<any[]> {
  try {
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

    return results || [];
  } catch (error) {
    console.error('Failed to get SMS conversations:', error);
    return [];
  }
}

// Get SMS messages for a specific conversation
export async function getSMSConversation(
  env: NotificationEnv,
  userId: number | string,
  phoneNumber: string
): Promise<SMSMessage[]> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, direction, message, created_at, status, message_sid
       FROM sms_messages
       WHERE user_id = ? AND phone_number = ?
       ORDER BY created_at DESC
       LIMIT 100`
    ).bind(userId, phoneNumber).all();

    return (results || []) as unknown as SMSMessage[];
  } catch (error) {
    console.error('Failed to get SMS conversation:', error);
    return [];
  }
}
