// In: 777lotto/portal/portal-bet/chat-worker/src/index.ts

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@portal/shared';

type AppEnv = {
  Bindings: Env & {
    DYTE_ORG_ID: string;
    DYTE_API_KEY: string;
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

  const { DYTE_ORG_ID, DYTE_API_KEY } = c.env;

  if (!DYTE_ORG_ID || !DYTE_API_KEY) {
    console.error("Realtime Kit credentials are not configured.");
    return c.json({ error: "Chat service is not configured." }, 500);
  }

  const meetingId = "a-static-meeting-id-for-everyone";

  // --- THIS IS THE CORRECTED LINE ---
  const rtkApiUrl = `https://rtk.realtime.cloudflare.com/v2/meetings/${meetingId}/participants`;
  // ---------------------------------

  const rtkResponse = await fetch(rtkApiUrl, { // Use the new URL
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // The Authorization header uses the Org ID and API Key as a Basic auth token
      'Authorization': `Basic ${btoa(`${DYTE_ORG_ID}:${DYTE_API_KEY}`)}`
    },
    body: JSON.stringify({
      name: userName,
      preset_name: userRole === 'admin' ? 'group_call_host' : 'group_call_participant',
      custom_participant_id: userId,
    }),
  });

  if (!rtkResponse.ok) {
    const errorBody = await rtkResponse.text();
    console.error("Failed to create Realtime Kit token:", errorBody);
    return c.json({ error: "Could not authenticate for chat service." }, 500);
  }

  const responseData = await rtkResponse.json() as any;

  return c.json({
    token: responseData.data.token
  });
});

export default app;
