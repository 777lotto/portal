import { Context } from 'hono';
import { AppEnv } from './index.js';

export const handleSmsProxy = async (c: Context<AppEnv>) => {
    // 1. Get the sub-path the user is trying to access (e.g., /conversations, /conversation/123)
    const url = new URL(c.req.url);
    const subPath = url.pathname.replace(/^\/api\/sms/, ''); // Safely get the part after /api/sms

    // 2. Get the URL of the internal notification service from environment variables.
    //    In Cloudflare, this would be a "Service Binding".
    const notificationService = c.env.NOTIFICATION_SERVICE;
    if (!notificationService) {
        console.error("NOTIFICATION_SERVICE binding is not configured.");
        return c.json({ error: "SMS service is currently unavailable" }, 503);
    }

    // 3. Construct the target URL for the internal request.
    const targetUrl = new URL(url.origin); // Start with a base URL
    targetUrl.pathname = `/api/sms${subPath}`; // The notification worker also listens on this path
    targetUrl.search = url.search; // Forward any query parameters

    // 4. Create a new request to forward, preserving the original method, headers, and body.
    const newRequest = new Request(targetUrl.toString(), c.req.raw);

    // 5. Add internal-only headers for the notification service to use for authorization and context.
    const user = c.get('user');
    newRequest.headers.set('X-Internal-User-Id', user.id.toString());
    newRequest.headers.set('X-Internal-User-Role', user.role);

    try {
        // 6. Use the service binding to fetch from the notification worker and return its response directly.
        const response = await notificationService.fetch(newRequest);
        return response;
    } catch (e: any) {
        console.error("Failed to proxy request to notification service:", e);
        return c.json({ error: "An error occurred while communicating with the SMS service" }, 500);
    }
};
