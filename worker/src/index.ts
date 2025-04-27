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
// src/index.ts
import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import type { Env } from './env';  // your Env interface, see below

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // --- 1) ping
    if (request.method === 'GET' && url.pathname === '/api/ping') {
      return new Response(JSON.stringify({ message: 'pong' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- 2) login
    if (request.method === 'POST' && url.pathname === '/api/login') {
      const { email, password } = await request.json();

      // look up user
      const { results } = await env.DB.prepare(
        `SELECT id, email, name, password_hash
         FROM users
         WHERE email = ?`
      )
      .bind(email)
      .all();

      if (results.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
      }

      const user = results[0];
      // replace this with whatever hash check you actually use:
      const passwordsMatch = user.password_hash === password;  
      if (!passwordsMatch) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
      }

      // issue a JWT
      const token = await new SignJWT({ email: user.email, name: user.name })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(env.JWT_SECRET);

      return new Response(JSON.stringify({ token }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- 3) profile
    if (request.method === 'GET' && url.pathname === '/api/profile') {
      const auth = request.headers.get('Authorization') || '';
      if (!auth.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing token' }), { status: 401 });
      }
      const token = auth.slice(7);

      let payload: JWTPayload;
      try {
        ({ payload } = await jwtVerify(token, env.JWT_SECRET));
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
      }

      const email = payload.email as string;
      const { results } = await env.DB.prepare(
        `SELECT id, email, name
         FROM users
         WHERE email = ?`
      )
      .bind(email)
      .all();

      if (results.length === 0) {
        return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
      }

      return new Response(JSON.stringify(results[0]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- fallback
    return new Response('Not found', { status: 404 });
  },
};
