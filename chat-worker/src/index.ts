// In: 777lotto/portal/portal-bet/chat-worker/src/index.ts

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import manifest from '__STATIC_CONTENT_MANIFEST';
import type { Env, User } from '@portal/shared';
import { jwtVerify } from 'jose'; // NEW: Import jwtVerify

type AppEnv = {
  Bindings: Env & {
    CLOUDFLARE_API_TOKEN: string;
  };
};

// NEW: Add this helper function to create the secret key
function getJwtSecretKey(secret: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(secret);
}

const app = new Hono<AppEnv>();

app.use('*', cors());

// MODIFICATION: Replace the entire existing `/api/token` (or `/api/chat/token`) handler with this new logic.
app.post('/api/chat/token', async (c) => {
  let userId, userName, userRole;

  // Case 1: Request is from the main worker's proxy (internal headers are present)
  const internalUserId = c.req.header('X-Internal-User-Id');
  if (internalUserId) {
    userId = internalUserId;
    userName = c.req.header('X-Internal-User-Name') || 'User';
    userRole = c.req.header('X-Internal-User-Role') || 'customer';
  } else {
    // Case 2: Direct request from standalone app. We must validate the JWT.
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (!token) {
      return c.json({ error: "Unauthorized: Missing token" }, 401);
    }

    try {
      const secret = getJwtSecretKey(c.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      const user = payload as User;

      // Check if the user is authorized for the standalone chat app
      if (user.role !== 'admin' && user.role !== 'associate') {
          return c.json({ error: 'Forbidden: You do not have permission to access chat.' }, 403);
      }

      userId = user.id.toString();
      userName = user.name;
      userRole = user.role;
    } catch (e) {
      console.error("JWT validation failed in chat-worker:", e);
      return c.json({ error: "Unauthorized: Invalid token" }, 401);
    }
  }

  // The rest of the logic for getting a RealtimeKit token is the same
  const { CLOUDFLARE_API_TOKEN } = c.env;
  if (!CLOUDFLARE_API_TOKEN) {
    console.error("CLOUDFLARE_API_TOKEN is not configured.");
    return c.json({ error: "Chat service is not configured." }, 500);
  }

  const meetingId = "a-static-meeting-id-for-everyone";
  const rtkApiUrl = `https://rtk.realtime.cloudflare.com/v2/meetings/${meetingId}/participants`;

  const rtkResponse = await fetch(rtkApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
    },
    body: JSON.stringify({
      name: userName,
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
  return c.json({ token: responseData.data.token });
});

// Serve static files for the chat frontend
app.get('/*', serveStatic({ root: './', manifest }));
app.get('*', serveStatic({ path: './index.html', manifest }));

export default app;
