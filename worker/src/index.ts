// src/index.ts
import { SignJWT, jwtVerify, JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import type { Env } from "./env";

// Helper to fix JWT signing with Cloudflare string secrets
function getJwtSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1) CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // 2) Ping
    if (request.method === "GET" && url.pathname === "/api/ping") {
      return new Response(JSON.stringify({ message: "pong" }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // 3) Signup → hash & insert → issue JWT
    if (request.method === "POST" && url.pathname === "/api/signup") {
      try {
        const { email, name, password } = await request.json();
        const password_hash = await bcrypt.hash(password, 10);

        await env.DB.prepare(
          `INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)`
        )
          .bind(email, name, password_hash)
          .run();

        // Issue a token immediately
        const token = await new SignJWT({ email, name })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("2h")
          .sign(getJwtSecretKey(env.JWT_SECRET));

        return new Response(JSON.stringify({ token }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        const msg = err.message.includes("UNIQUE constraint failed")
          ? "An account with that email already exists"
          : "Signup failed";
        return new Response(JSON.stringify({ error: msg }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // 4) Login → verify & issue JWT
    if (request.method === "POST" && url.pathname === "/api/login") {
      try {
        const { email, password } = await request.json();
        const { results } = await env.DB.prepare(
          `SELECT email, name, password_hash FROM users WHERE email = ?`
        )
          .bind(email)
          .all();

        if (results.length === 0) throw new Error("Invalid credentials");
        const user = results[0];

        if (!(await bcrypt.compare(password, user.password_hash))) {
          throw new Error("Invalid credentials");
        }

        const token = await new SignJWT({ email: user.email, name: user.name })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("2h")
          .sign(getJwtSecretKey(env.JWT_SECRET));

        return new Response(JSON.stringify({ token }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

  // 5) Profile → verify JWT → lookup user
    if (request.method === "GET" && url.pathname === "/api/profile") {
      try {
        const auth = request.headers.get("Authorization") || "";
        if (!auth.startsWith("Bearer ")) throw new Error("Missing token");

        const token = auth.slice(7);
        const { payload } = await jwtVerify(token, getJwtSecretKey(env.JWT_SECRET));
        const email = payload.email as string;

        const { results } = await env.DB.prepare(
          `SELECT id, email, name FROM users WHERE email = ?`
        )
          .bind(email)
          .all();

        if (results.length === 0) throw new Error("User not found");
        return new Response(JSON.stringify(results[0]), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // ─── NEW: List services for current user ─────────────────────────────
    if (request.method === "GET" && url.pathname === "/api/services") {
      try {
        const auth = request.headers.get("Authorization") || "";
        if (!auth.startsWith("Bearer ")) throw new Error("Missing token");
        const { payload } = await jwtVerify(auth.slice(7), getJwtSecretKey(env.JWT_SECRET));
        const userEmail = payload.email as string;

        // find user_id
        const userRow = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
          .bind(userEmail)
          .first();
        if (!userRow) throw new Error("User not found");

        const { results } = await env.DB.prepare(
          `SELECT * FROM services
           WHERE user_id = ?
           ORDER BY service_date DESC`
        )
          .bind(userRow.id)
          .all();

        return new Response(JSON.stringify(results), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // ─── NEW: Create a new service ────────────────────────────────────────
    if (request.method === "POST" && url.pathname === "/api/services") {
      try {
        const auth = request.headers.get("Authorization") || "";
        if (!auth.startsWith("Bearer ")) throw new Error("Missing token");
        const { payload } = await jwtVerify(auth.slice(7), getJwtSecretKey(env.JWT_SECRET));
        const userEmail = payload.email as string;

        // find user_id
        const userRow = await env.DB.prepare(`SELECT id FROM users WHERE email = ?`)
          .bind(userEmail)
          .first();
        if (!userRow) throw new Error("User not found");

        const { service_date, status, notes } = await request.json();
        const insert = await env.DB.prepare(
          `INSERT INTO services
             (user_id, service_date, status, notes)
           VALUES (?, ?, ?, ?)`
        )
          .bind(userRow.id, service_date, status || "upcoming", notes || "")
          .run();

        return new Response(JSON.stringify({ id: insert.lastInsertId }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // --- Edit an existing service ------------------------------------------
if (request.method === "PUT" && url.pathname.startsWith("/api/services/")) {
  try {
    const id = parseInt(url.pathname.split("/").pop()!);
    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) throw new Error("Missing token");

    const { payload } = await jwtVerify(auth.slice(7), getJwtSecretKey(env.JWT_SECRET));
    const userEmail = payload.email as string;

    // ensure the service belongs to the current user
    const serviceRow = await env.DB.prepare(
      `SELECT s.id FROM services s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND u.email = ?`
    ).bind(id, userEmail).first();
    if (!serviceRow) throw new Error("Not found");

    const { service_date, status, notes } = await request.json();
    await env.DB.prepare(
      `UPDATE services
       SET service_date = ?, status = ?, notes = ?
       WHERE id = ?`
    ).bind(service_date, status, notes, id).run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}

// --- Delete a service ----------------------------------------------------
if (request.method === "DELETE" && url.pathname.startsWith("/api/services/")) {
  try {
    const id = parseInt(url.pathname.split("/").pop()!);
    const auth = request.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) throw new Error("Missing token");

    const { payload } = await jwtVerify(auth.slice(7), getJwtSecretKey(env.JWT_SECRET));
    const userEmail = payload.email as string;

    // verify ownership then delete
    const { changes } = await env.DB.prepare(
      `DELETE FROM services
       WHERE id = (
         SELECT s.id FROM services s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND u.email = ?
       )`
    ).bind(id, userEmail).run();

    if (changes === 0) throw new Error("Not found");

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}

    // ─── FALLBACK ─────────────────────────────────────────────────────────
    return new Response("Not found", {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
