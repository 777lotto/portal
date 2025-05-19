// worker/src/sms.ts
import { Env, SMSWebhookRequest } from "@portal/shared";

// Function to send SMS
export async function sendSMS(
  env: Env,
  to: string,
  message: string
): Promise<{ success: boolean; error?: string; messageSid?: string }> {
  try {
    // Forward to notification worker
    const response = await env.NOTIFICATION_WORKER.fetch(
      new Request('https://portal.777.foo/api/notifications/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer internal'
        },
        body: JSON.stringify({ to, message })
      })
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error('SMS sending error:', error);
    return { success: false, error: error.message };
  }
}

// Handle incoming SMS
export async function handleIncomingSMS(
  request: Request,
  env: Env
): Promise<Response> {
  // Implementation would go here
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
