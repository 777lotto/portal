// src/index.ts

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import bcrypt from 'bcryptjs';
import type { Env } from './env';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // --- Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // --- Ping route
    if (request.method === 'GET' && url.pathname === '/api/ping') {
      return new Response(JSON.stringify({ message: 'pong' }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // --- Signup route (create new user)
    if (request.method === 'POST' && url.pathname === '/api/signup') {
      const { email, name, password } = await request.json();

      const password_hash = await bcrypt.hash(password, 10); // 10 salt rounds

      try {
        await env.DB.prepare(
          `INSERT INTO users (email, name, password_hash)
           VALUES (?, ?, ?)`
        )
          .bind(email, name, password_hash)
          .run();
      } catch (err) {
        return new Response(JSON.stringify({ error: 'User already exists or DB error' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // --- Login route
    if (request.method === 'POST' && url.pathname === '/api/login') {
      const { email, password } = await request.json();

      const { results } = await env.DB.prepare(
        `SELECT id, email, name, password_hash FROM users WHERE email = ?`
      )
        .bind(email)
        .all();

      if (results.length === 0) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const user = results[0];

      const passwordsMatch = await bcrypt.compare(password, user.password_hash);

      if (!passwordsMatch) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const token = await new SignJWT({ email: user.email, name: user.name })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(env.JWT_SECRET);

      return new Response(JSON.stringify({ token }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // --- Profile route (protected)
    if (request.method === 'GET' && url.pathname === '/api/profile') {
      const auth = request.headers.get('Authorization') || '';
      if (!auth.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Missing token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const token = auth.slice(7);

      let payload: JWTPayload;
      try {
        ({ payload } = await jwtVerify(token, env.JWT_SECRET));
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const email = payload.email as string;
      const { results } = await env.DB.prepare(
        `SELECT id, email, name FROM users WHERE email = ?`
      )
        .bind(email)
        .all();

      if (results.length === 0) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      return new Response(JSON.stringify(results[0]), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // --- fallback
    return new Response('Not found', {
      status: 404,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  },
};
