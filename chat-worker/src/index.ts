// In: 777lotto/portal/portal-bet/chat-worker/src/index.ts

import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import manifest from '__STATIC_CONTENT_MANIFEST';
import type { Env, User } from '@portal/shared';
import { jwtVerify } from 'jose';

type AppEnv = {
  Bindings: Env & {
    CLOUDFLARE_API_TOKEN: string;
    ACCOUNT_ID: string; // Add your Cloudflare Account ID here
    CHAT_SESSIONS_PROD: KVNamespace; // Use KV to store the session ID
  };
};

function getJwtSecretKey(secret: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(secret);
}

const app = new Hono<AppEnv>();

app.use('*', cors());

// --- NEW SESSION MANAGEMENT LOGIC ---

// A stable key to store our main chat room session ID in KV
const SESSION_KV_KEY = "main_chat_session_id";

// Creates a new voice conference session using the Cloudflare API
async function createNewSession(c: Context<AppEnv>) {
    const { ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CHAT_SESSIONS_PROD } = c.env;
    const apiUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/calls/v1/sessions`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Fatal: Could not create new chat session:", response.status, errorText);
        throw new Error('Could not create a new chat session.');
    }

    const data: any = await response.json();
    const sessionId = data.result.session_id;

    // Store the new session ID in KV for persistence across worker reloads
    await CHAT_SESSIONS_PROD.put(SESSION_KV_KEY, sessionId);
    return sessionId;
}

// Gets the current session ID, creating one if it doesn't exist
async function getSessionId(c: Context<AppEnv>) {
    let sessionId = await c.env.CHAT_SESSIONS_PROD.get(SESSION_KV_KEY);
    if (!sessionId) {
        sessionId = await createNewSession(c);
    }
    return sessionId;
}

// --- UPDATED TOKEN ENDPOINT ---

app.post('/api/chat/token', async (c) => {
    let userId, userName; // userRole is no longer needed for the token request

    const { CLOUDFLARE_API_TOKEN, ACCOUNT_ID } = c.env;
    if (!CLOUDFLARE_API_TOKEN || !ACCOUNT_ID) {
        console.error("FATAL: CLOUDFLARE_API_TOKEN or ACCOUNT_ID is not configured.");
        return c.json({ error: "Chat service is not configured." }, 500);
    }

    // --- Authenticate the user (same logic as before) ---
    const internalUserId = c.req.header('X-Internal-User-Id');
    if (internalUserId) {
        userId = internalUserId;
        userName = c.req.header('X-Internal-User-Name') || 'User';
    } else {
        const authHeader = c.req.header("Authorization");
        const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
        if (!token) return c.json({ error: "Unauthorized: Missing token" }, 401);

        try {
            const secret = getJwtSecretKey(c.env.JWT_SECRET);
            const { payload } = await jwtVerify(token, secret);
            const user = payload as User;
            userId = user.id.toString();
            userName = user.name;
        } catch (e) {
            console.error("JWT validation failed in chat-worker:", e);
            return c.json({ error: "Unauthorized: Invalid token" }, 401);
        }
    }

    try {
        // Step 1: Get the persistent session ID.
        const sessionId = await getSessionId(c);

        // Step 2: Generate a user-specific, temporary auth token for that session.
        const authApiUrl = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/calls/v1/sessions/${sessionId}/auth`;

        const authTokenResponse = await fetch(authApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                user_name: userName
            })
        });

        if (!authTokenResponse.ok) {
            const errorBody = await authTokenResponse.text();
            console.error("Failed to get user auth token:", authTokenResponse.status, errorBody);
            // If the session is invalid (e.g., expired), try creating a new one and retry
            if(authTokenResponse.status === 404) {
                 console.log("Session not found. Attempting to create a new one.");
                 await createNewSession(c); // This will update the KV store
                 return c.json({ error: "Chat session was refreshed. Please try again." }, 503);
            }
            return c.json({ error: "Could not authenticate for chat service." }, 500);
        }

        const authData: any = await authTokenResponse.json();

        // Step 3: Return both the session ID and the new token to the client.
        return c.json({
            sessionId: sessionId,
            token: authData.result.token
        });

    } catch (e) {
        console.error("Error in /api/chat/token handler:", e);
        return c.json({ error: "An internal error occurred while setting up the chat." }, 500);
    }
});


// Serve static files for the chat frontend
app.get('/*', serveStatic({ root: './', manifest }));
app.get('*', serveStatic({ path: './index.html', manifest }));

export default app;
