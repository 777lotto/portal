// src/index.ts
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Env } from "./env";
import {
  getOrCreateCustomer,
  createAndSendInvoice,
  getStripe,
} from "./stripe";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function getJwtSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

async function requireAuth(request: Request, env: Env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("Missing token");
  const { payload } = await jwtVerify(
    auth.slice(7),
    getJwtSecretKey(env.JWT_SECRET)
  );
  return payload.email as string;
}

/* ------------------------------------------------------------------ */
/* Worker                                                             */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    /* ---------- CORS pre-flight ---------- */
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    /* ---------- Ping ---------- */
    if (request.method === "GET" && url.pathname === "/api/ping") {
      return new Response(JSON.stringify({ message: "pong" }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    /* ---------- Signup ---------- */
    if (request.method === "POST" && url.pathname === "/api/signup") {
      try {
        const { email, name, password } = await request.json();
        const password_hash = await bcrypt.hash(password, 10);

        await env.DB.prepare(
          `INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)`
        )
          .bind(email, name, password_hash)
          .run();

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

    /* ---------- Login ---------- */
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

    /* ---------- Profile ---------- */
    if (request.method === "GET" && url.pathname === "/api/profile") {
      try {
        const email = await requireAuth(request, env);
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

    /* ---------- List services ---------- */
    if (request.method === "GET" && url.pathname === "/api/services") {
      try {
        const email = await requireAuth(request, env);
        const userRow = await env.DB.prepare(
          `SELECT id FROM users WHERE email = ?`
        )
          .bind(email)
          .first();
        if (!userRow) throw new Error("User not found");

        const { results } = await env.DB.prepare(
          `SELECT * FROM services WHERE user_id = ? ORDER BY service_date DESC`
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

    /* ---------- Get single service ---------- */
    if (request.method === "GET" && url.pathname.startsWith("/api/services/")) {
      if (url.pathname !== "/api/services") {
        try {
          const id = parseInt(url.pathname.split("/").pop()!);
          const email = await requireAuth(request, env);

          const row = await env.DB.prepare(
            `SELECT s.* FROM services s
             JOIN users u ON u.id = s.user_id
             WHERE s.id = ? AND u.email = ?`
          )
            .bind(id, email)
            .first();

          if (!row) throw new Error("Not found");
          return new Response(JSON.stringify(row), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      }
    }

    /* ---------- Create service ---------- */
    if (request.method === "POST" && url.pathname === "/api/services") {
      try {
        const email = await requireAuth(request, env);
        const userRow = await env.DB.prepare(
          `SELECT id FROM users WHERE email = ?`
        )
          .bind(email)
          .first();
        if (!userRow) throw new Error("User not found");

        const { service_date, status, notes } = await request.json();
        const insert = await env.DB.prepare(
          `INSERT INTO services (user_id, service_date, status, notes)
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

    /* ---------- Update service ---------- */
    if (request.method === "PUT" && url.pathname.startsWith("/api/services/")) {
      try {
        const id = parseInt(url.pathname.split("/").pop()!);
        const email = await requireAuth(request, env);

        const owner = await env.DB.prepare(
          `SELECT s.id FROM services s
           JOIN users u ON u.id = s.user_id
           WHERE s.id = ? AND u.email = ?`
        )
          .bind(id, email)
          .first();
        if (!owner) throw new Error("Not found");

        const { service_date, status, notes } = await request.json();
        await env.DB.prepare(
          `UPDATE services
           SET service_date = ?, status = ?, notes = ?
           WHERE id = ?`
        )
          .bind(service_date, status, notes, id)
          .run();

        return new Response(JSON.stringify({ ok: true }), {
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

    /* ---------- Delete service ---------- */
    if (request.method === "DELETE" && url.pathname.startsWith("/api/services/")) {
      try {
        const id = parseInt(url.pathname.split("/").pop()!);
        const email = await requireAuth(request, env);

        const { changes } = await env.DB.prepare(
          `DELETE FROM services
           WHERE id = (
             SELECT s.id FROM services s
             JOIN users u ON u.id = s.user_id
             WHERE s.id = ? AND u.email = ?
           )`
        )
          .bind(id, email)
          .run();
        if (changes === 0) throw new Error("Not found");

        return new Response(JSON.stringify({ ok: true }), {
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

    // ─── Stripe Customer Portal ────────────────────────────────────────────
    if (request.method === "POST" && url.pathname === "/api/portal") {
      try {
        const email = await requireAuth(request, env);

        // fetch stored Stripe customer ID
        const { stripe_customer_id } = (await env.DB.prepare(
          `SELECT stripe_customer_id FROM users WHERE email = ?`
        )
          .bind(email)
          .first()) as { stripe_customer_id: string | null };

        if (!stripe_customer_id) {
          throw new Error("No Stripe customer on file");
        }

        const origin = request.headers.get("Origin") ?? "";
        const stripe = getStripe(env);
        const session = await stripe.billingPortal.sessions.create({
          customer: stripe_customer_id,
          return_url: origin,
        });

        return new Response(JSON.stringify({ url: session.url }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin || "*",
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

    /* ---------- Fallback ---------- */
    return new Response("Not found", {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
} satisfies ExportedHandler<Env>;
