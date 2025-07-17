import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import type { Env, User } from '@portal/shared';

// This is the auth middleware you will share from your main worker
import { requireAuthMiddleware } from '../../worker/src/auth.js';

type AppEnv = {
  Bindings: Env & {
    DYTE_ORG_ID: string;
    DYTE_API_KEY: string;
  };
  Variables: {
    user: User;
  };
};

const app = new Hono<AppEnv>();

app.use('*', cors());

app.post('/api/token', requireAuthMiddleware, async (c) => {
  const user = c.get('user');
  const { DYTE_ORG_ID, DYTE_API_KEY } = c.env;

  if (!DYTE_ORG_ID || !DYTE_API_KEY) {
    console.error("Dyte credentials are not configured.");
    return c.json({ error: "Chat service is not configured." }, 500);
  }

  // In a real app, you would dynamically create or fetch a meeting ID
  const meetingId = "a-static-meeting-id-for-everyone";
  const dyteApiUrl = `https://api.dyte.io/v2/meetings/${meetingId}/participants`;

  // Construct the API request to Dyte's backend
  const dyteResponse = await fetch(dyteApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Authenticate using your API Key as a Basic auth header
      'Authorization': `Basic ${btoa(`${DYTE_ORG_ID}:${DYTE_API_KEY}`)}`
    },
    body: JSON.stringify({
      name: user.name,
      preset_name: user.role === 'admin' ? 'group_call_host' : 'group_call_participant',
      custom_participant_id: user.id.toString(),
    }),
  });

  if (!dyteResponse.ok) {
    const errorBody = await dyteResponse.text();
    console.error("Failed to create Dyte token:", errorBody);
    return c.json({ error: "Could not authenticate for chat service." }, 500);
  }

  const responseData = await dyteResponse.json() as any;

  return c.json({
    token: responseData.data.token
  });
});

export default app;
