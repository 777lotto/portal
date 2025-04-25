/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { SignJWT, jwtVerify } from 'jose';

const USERS = {
  "user@example.com": { password: "hunter2", name: "Demo User" },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const JWT_SECRET = env.JWT_SECRET as string;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin':  '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        },
      });
    }

    // Login
    if (url.pathname === '/api/login' && request.method === 'POST') {
      const { email, password } = await request.json();
      const user = USERS[email];
      if (!user || user.password !== password) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
      const alg = 'HS256';
      const token = await new SignJWT({ email })
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(new TextEncoder().encode(JWT_SECRET));

      return new Response(JSON.stringify({ token }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Profile
    if (url.pathname === '/api/profile' && request.method === 'GET') {
      const auth = request.headers.get('Authorization') || '';
      const token = auth.replace(/^Bearer\s+/, '');
      try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
        return new Response(JSON.stringify({ email: payload.email, name: USERS[payload.email].name }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
} satisfies ExportedHandler<Env>;
