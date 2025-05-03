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

// normalize incoming email to lowercase (trimmed)
function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

// build CORS headers quickly
const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

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
/* ─── STEP 1: Check email for signup + return existing name ──────────── */
if (request.method === "POST" && url.pathname === "/api/signup/check") {
  try {
    // parse & normalize
    const raw = await request.json();
    const email = normalizeEmail(raw.email);

    // lookup password_hash + name
    const existingUser = await env.DB.prepare(
      `SELECT password_hash, name
         FROM users
        WHERE lower(email) = ?`
    )
      .bind(email)
      .first() as { password_hash: string | null; name: string };

    if (existingUser) {
      if (!existingUser.password_hash) {
        // imported user, no password yet
        return new Response(
          JSON.stringify({ status: "existing", name: existingUser.name }),
          { headers: CORS }
        );
      }
      // fully signed up already
      return new Response(
        JSON.stringify({ error: "Account already exists" }),
        { status: 400, headers: CORS }
      );
    }

    // brand‑new user
    return new Response(JSON.stringify({ status: "new" }), {
      headers: CORS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

/* ─── STEP 2: Complete signup or create new ───────────────────────────── */
if (request.method === "POST" && url.pathname === "/api/signup") {
  try {
    // parse & normalize payload
    const raw = await request.json();
    const email = normalizeEmail(raw.email);
    const name = raw.name;
    const password = raw.password;
    const password_hash = await bcrypt.hash(password, 10);

    // check for an existing row
    const existingUser = await env.DB.prepare(
      `SELECT password_hash, stripe_customer_id
         FROM users
        WHERE lower(email) = ?`
    )
      .bind(email)
      .first() as { password_hash: string | null; stripe_customer_id: string | null };

    if (existingUser) {
      if (!existingUser.password_hash) {
        // finish setting up imported user
        await env.DB.prepare(
          `UPDATE users
              SET name = ?, password_hash = ?
            WHERE lower(email) = ?`
        )
          .bind(name, password_hash, email)
          .run();

        // sync name to Stripe
        if (existingUser.stripe_customer_id) {
          const stripe = getStripe(env);
          await stripe.customers.update(existingUser.stripe_customer_id, {
            name,
          });
        }
      } else {
        throw new Error("Account already exists");
      }
    } else {
      // brand‑new signup
      await env.DB.prepare(
        `INSERT INTO users (email, name, password_hash)
           VALUES (?, ?, ?)`
      )
        .bind(email, name, password_hash)
        .run();
    }

    // issue JWT
    const token = await new SignJWT({ email, name })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(getJwtSecretKey(env.JWT_SECRET));

    return new Response(JSON.stringify({ token }), {
      headers: CORS,
    });
  } catch (err: any) {
    const isConflict = err.message === "Account already exists";
    return new Response(
      JSON.stringify({ error: err.message || "Signup failed" }),
      {
        status: isConflict ? 400 : 500,
        headers: CORS,
      }
    );
  }
}


/* ---------- Login ---------- */
if (request.method === "POST" && url.pathname === "/api/login") {
  try {
    // 1) parse & normalize payload
    const raw = await request.json();
    const email = normalizeEmail(raw.email);
    const password = raw.password;

    // 2) fetch user by lowercased email
    const { results: loginResults } = await env.DB.prepare(
      `SELECT email, name, password_hash
         FROM users
        WHERE lower(email) = ?`
    )
      .bind(email)
      .all();

    // 3) validate credentials
    if (loginResults.length === 0) {
      throw new Error("Invalid credentials");
    }
    const user = loginResults[0];
    if (!(await bcrypt.compare(password, user.password_hash))) {
      throw new Error("Invalid credentials");
    }

    // 4) issue JWT
    const token = await new SignJWT({ email: user.email, name: user.name })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(getJwtSecretKey(env.JWT_SECRET));

    return new Response(JSON.stringify({ token }), {
      headers: CORS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 401,
      headers: CORS,
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
        return new Response(JSON.stringify({ url: session.url }), {
          status: 400,
         headers: {
    ...CORS,
    "Access-Control-Allow-Origin": origin || "*",
          },
        });
      }
    }

    // ─── Stripe Customer Portal ────────────────────────────────────────────
if (request.method === "POST" && url.pathname === "/api/portal") {
  try {
    const email = await requireAuth(request, env);
    // …lookup stripe_customer_id, create session…

    if (!session.url) {
      throw new Error("Failed to create customer portal session");
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: {
          …CORS,
          "Access-Control-Allow-Origin": origin || "*",
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 400,
        headers: {
          …CORS,
          "Access-Control-Allow-Origin": origin || "*",
        },
      }
    );
  }
}

// ─── Stripe webhook handler ─────────────────────────────────────────────
if (request.method === "POST" && url.pathname === "/stripe/webhook") {
  // 1) Grab signature & raw body
  const sig = request.headers.get("Stripe-Signature")!;
  const bodyText = await request.text();

  // 2) Verify signature & parse event
  let event: Stripe.Event;
  try {
    event = getStripe(env).webhooks.constructEvent(
      bodyText,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    ) as Stripe.Event;
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Webhook Error: ${err.message}` }),
      { status: 400, headers: CORS }
    );
  }

  // 3) Handle only customer.created
  if (event.type === "customer.created") {
    const customer = event.data.object as Stripe.Customer;
    const email = normalizeEmail(customer.email || "");
    const name = customer.name || "";

    if (email) {
      await env.DB.prepare(
        `INSERT INTO users
           (email, name, password_hash, stripe_customer_id)
         SELECT ?, ?, '', ?
         WHERE NOT EXISTS (
           SELECT 1 FROM users WHERE lower(email) = ?
         )`
      )
        .bind(email, name, customer.id, email)
        .run();
    }
  }

  // 4) Acknowledge receipt
  return new Response(JSON.stringify({ received: true }), {
    headers: CORS,
  });
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
