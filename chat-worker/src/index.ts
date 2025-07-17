// In: 777lotto/portal/portal-bet/chat-worker/src/index.ts

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import manifest from '__STATIC_CONTENT_MANIFEST';
import type { Env } from '@portal/shared';

type AppEnv = {
  Bindings: Env & {
    // MODIFIED: Changed to the correct secret name for the Cloudflare API Token
    CLOUDFLARE_API_TOKEN: string;
  };
};

const app = new Hono<AppEnv>();

app.use('*', cors());

app.post('/api/token', async (c) => {
  const userId = c.req.header('X-Internal-User-Id');
  const userName = c.req.header('X-Internal-User-Name') || 'User';
  const userRole = c.req.header('X-Internal-User-Role') || 'customer';

  if (!userId) {
    return c.json({ error: 'Unauthorized: Missing user identification' }, 401);
  }

  // MODIFIED: Use the correct environment variable
  const { CLOUDFLARE_API_TOKEN } = c.env;

  if (!CLOUDFLARE_API_TOKEN) {
    console.error("CLOUDFLARE_API_TOKEN is not configured.");
    return c.json({ error: "Chat service is not configured." }, 500);
  }

  // This is the ID of a meeting you have created in the Cloudflare dashboard.
  const meetingId = "a-static-meeting-id-for-everyone";
  const rtkApiUrl = `https://rtk.realtime.cloudflare.com/v2/meetings/${meetingId}/participants`;

  const rtkResponse = await fetch(rtkApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // MODIFIED: Changed Authorization to use Bearer token as required by the docs
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
    },
    body: JSON.stringify({
      name: userName,
      // You can map your internal roles to Realtime Kit presets
      preset_name: userRole === 'admin' ? 'group_call_host' : 'group_call_participant',
      custom_participant_id: userId,
    }),
  });

  if (!rtkResponse.ok) {
    const errorBody = await rtkResponse.text();
    console.error("Failed to create Realtime Kit token:", rtkResponse.status, errorBody);
    return c.json({ error: "Could not authenticate for chat service." }, 500);
  }

  const responseData = await rtkResponse.json() as any;

  // The token is nested under `data.token`
  return c.json({
    token: responseData.data.token
  });
});

// Serve static files for the chat frontend
app.get('/*', serveStatic({
    root: './',
    manifest,
}));
app.get('*', serveStatic({
    path: './index.html',
    manifest,
}));

export default app;
