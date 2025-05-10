// src/index.ts
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { Env } from "./env";
import {
  getOrCreateCustomer,
  createAndSendInvoice,
  getStripe,
} from "./stripe";
import { v4 as uuidv4 } from 'uuid';
import {
  getCustomerJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  generateCalendarFeed
} from './calendar';

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
       return new Response(JSON.stringify({ token }), {
     status: 200,
     headers: CORS,
   });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 401,
      headers: CORS,
    });
  }
}

/* ─── Profile (customer‑facing) ───────────────────────────────────────── */
if (request.method === "GET" && url.pathname === "/api/profile") {
  try {
    // 1) Verify JWT & get user email
    const email = await requireAuth(request, env);

    // 2) Fetch the user record (case‑insensitive email)
    const { results: userResults } = await env.DB.prepare(
      `SELECT id, email, name
         FROM users
        WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .all();

    if (userResults.length === 0) {
      throw new Error("User not found");
    }

    // 3) Return the first (and only) record
    return new Response(JSON.stringify(userResults[0]), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    // 401 for auth errors or if JWT is missing/invalid
    return new Response(JSON.stringify({ error: err.message }), {
      status: 401,
      headers: CORS,
    });
  }
}

/* ─── List services (customer‑facing) ─────────────────────────────────── */
if (request.method === "GET" && url.pathname === "/api/services") {
  try {
    // verify JWT and get user email
    const email = await requireAuth(request, env);

    // lookup the user’s ID
    const userRow = await env.DB.prepare(
      `SELECT id
         FROM users
        WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();
    if (!userRow) throw new Error("User not found");

    // fetch all services for that user
    const { results: servicesList } = await env.DB.prepare(
      `SELECT *
         FROM services
        WHERE user_id = ?
        ORDER BY service_date DESC`
    )
      .bind(userRow.id)
      .all();

    return new Response(JSON.stringify(servicesList), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 401,
      headers: CORS,
    });
  }
}

/* ─── Get single service (customer-facing) ─────────────────────────────── */
if (request.method === "GET" && url.pathname.match(/^\/api\/services\/\d+$/)) {
  try {
    const id = parseInt(url.pathname.split("/").pop()!, 10);
    const email = await requireAuth(request, env);

    const row = await env.DB.prepare(
      `SELECT s.* FROM services s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND u.email = ?`
    )
      .bind(id, email)
      .first();

    if (!row) {
      // no record or not yours
      throw new Error("Not found");
    }

    return new Response(JSON.stringify(row), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    // return 404 on “Not found”, 400 on any other error
    const status = err.message === "Not found" ? 404 : 400;
    return new Response(JSON.stringify({ error: err.message }), {
      status,
      headers: CORS,
    });
  }
}


/* ---------- Create service (admin-only) ---------- */
if (request.method === "POST" && url.pathname === "/api/services") {
  try {
    // verify user
    const email = await requireAuth(request, env);
    const userRow = await env.DB.prepare(
      `SELECT id FROM users WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();

    if (!userRow) throw new Error("User not found");

    // pull data
    const { service_date, status, notes } = await request.json();

    // insert
    const insert = await env.DB.prepare(
      `INSERT INTO services
         (user_id, service_date, status, notes)
       VALUES (?, ?, ?, ?)`
    )
      .bind(userRow.id, service_date, status || "upcoming", notes || "")
      .run();

    // return the new ID
    return new Response(JSON.stringify({ id: insert.lastInsertId }), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}


/* ---------- Update service (admin-only) ---------- */
if (request.method === "PUT" && url.pathname.startsWith("/api/services/")) {
  try {
    const id = parseInt(url.pathname.split("/").pop()!, 10);
    const email = await requireAuth(request, env);

    // verify ownership
    const owner = await env.DB.prepare(
      `SELECT s.id
         FROM services s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND u.email = ?`
    )
      .bind(id, email)
      .first();
    if (!owner) throw new Error("Not found");

    // pull updated fields from body
    const { service_date, status, notes } = await request.json();

    // perform update
    await env.DB.prepare(
      `UPDATE services
          SET service_date = ?, status = ?, notes = ?
        WHERE id = ?`
    )
      .bind(service_date, status, notes, id)
      .run();

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}


// ─── Delete service (admin-only) ────────────────────────────────────────
if (request.method === "DELETE" && url.pathname.startsWith("/api/services/")) {
  try {
    const id = parseInt(url.pathname.split("/").pop()!);
    // requireAuth will verify the JWT and return the user’s email
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

    if (changes === 0) {
      throw new Error("Not found");
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

/* ─── Jobs Endpoints ───────────────────────────────────── */
if (request.method === "GET" && url.pathname === "/api/jobs") {
  try {
    // Verify JWT and get user email
    const email = await requireAuth(request, env);

    // Lookup the user's ID
    const userRow = await env.DB.prepare(
      `SELECT id, stripe_customer_id FROM users WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();

    if (!userRow) throw new Error("User not found");
    if (!userRow.stripe_customer_id) throw new Error("Customer not found");

    // Get jobs for this customer
    const jobs = await getCustomerJobs(env, userRow.stripe_customer_id);

    return new Response(JSON.stringify(jobs), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 401,
      headers: CORS,
    });
  }
}

// Get a specific job
if (request.method === "GET" && url.pathname.match(/^\/api\/jobs\/[a-f0-9-]+$/)) {
  try {
    const jobId = url.pathname.split("/").pop()!;
    const email = await requireAuth(request, env);

    // Get user and customer info
    const userRow = await env.DB.prepare(
      `SELECT id, stripe_customer_id FROM users WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();

    if (!userRow || !userRow.stripe_customer_id) throw new Error("User not found");

    // Check if job belongs to customer
    const job = await env.DB.prepare(
      `SELECT * FROM jobs WHERE id = ? AND customerId = ?`
    )
      .bind(jobId, userRow.stripe_customer_id)
      .first();

    if (!job) throw new Error("Job not found");

    return new Response(JSON.stringify(job), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    const status = err.message === "Job not found" ? 404 : 401;
    return new Response(JSON.stringify({ error: err.message }), {
      status,
      headers: CORS,
    });
  }
}

// Create a new job (admin-only in this implementation)
if (request.method === "POST" && url.pathname === "/api/jobs") {
  try {
    // Verify user is admin (you might want to add an isAdmin check)
    const email = await requireAuth(request, env);
    const userRow = await env.DB.prepare(
      `SELECT id, stripe_customer_id FROM users WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();

    if (!userRow || !userRow.stripe_customer_id) throw new Error("User not found");

    // Get job data from request
    const jobData = await request.json();

    // Create the job
    const newJob = await createJob(env, jobData, userRow.stripe_customer_id);

    return new Response(JSON.stringify(newJob), {
      status: 201,
      headers: CORS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

// Update a job (admin-only)
if (request.method === "PUT" && url.pathname.match(/^\/api\/jobs\/[a-f0-9-]+$/)) {
  try {
    const jobId = url.pathname.split("/").pop()!;
    const email = await requireAuth(request, env);

    // Get user and verify permissions
    const userRow = await env.DB.prepare(
      `SELECT id, stripe_customer_id FROM users WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();

    if (!userRow || !userRow.stripe_customer_id) throw new Error("User not found");

    // Get update data
    const updateData = await request.json();

    // Update the job
    const updatedJob = await updateJob(env, jobId, updateData, userRow.stripe_customer_id);

    return new Response(JSON.stringify(updatedJob), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

// Delete a job (admin-only)
if (request.method === "DELETE" && url.pathname.match(/^\/api\/jobs\/[a-f0-9-]+$/)) {
  try {
    const jobId = url.pathname.split("/").pop()!;
    const email = await requireAuth(request, env);

    // Get user and verify permissions
    const userRow = await env.DB.prepare(
      `SELECT id, stripe_customer_id FROM users WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();

    if (!userRow || !userRow.stripe_customer_id) throw new Error("User not found");

    // Delete the job
    await deleteJob(env, jobId, userRow.stripe_customer_id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

// Calendar feed endpoint
if (request.method === "GET" && url.pathname === "/api/calendar-feed") {
  try {
    // This endpoint is special - it uses a token in the URL for external calendar apps
    const token = url.searchParams.get("token");
    if (!token) throw new Error("Missing token");

    // Verify the token and get user
    const { payload } = await jwtVerify(token, getJwtSecretKey(env.JWT_SECRET));
    const email = payload.email as string;

    // Get customer ID
    const userRow = await env.DB.prepare(
      `SELECT stripe_customer_id FROM users WHERE lower(email) = ?`
    )
      .bind(email.toLowerCase())
      .first();

    if (!userRow || !userRow.stripe_customer_id) throw new Error("User not found");

    // Generate iCal feed
    const icalContent = await generateCalendarFeed(env, userRow.stripe_customer_id);

    return new Response(icalContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar",
        "Content-Disposition": "attachment; filename=\"calendar.ics\"",
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 401,
      headers: CORS,
    });
  }
}


    // ─── Stripe Customer Portal ────────────────────────────────────────────
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

         // ← if we ever fail to get a URL, bail early
         if (!session.url) {
           throw new Error("Failed to create customer portal session");
         }
        return new Response(JSON.stringify({ url: session.url }), {
          status: 200,
          headers: {
            ...CORS,
           "Access-Control-Allow-Origin": origin || "*"
          },
        });
       } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: {
            ...CORS,
            "Access-Control-Allow-Origin": origin || "*"
          },
        });
  }
}

 // worker/src/index.ts - Stripe webhook section

// ─── Stripe webhook handler ─────────────────────────────────────────────
if (request.method === "POST" && url.pathname === "/stripe/webhook") {
  // Create a clone of the request to ensure we can read the body
  const clonedRequest = request.clone();

  // Webhook requests don't need CORS headers
  const webhookHeaders = {
    "Content-Type": "application/json"
  };

  try {
    // 1) Grab signature & raw body
    const sig = request.headers.get("Stripe-Signature");
    if (!sig) {
      console.error("Missing Stripe signature");
      return new Response(
        JSON.stringify({ error: "Missing Stripe signature" }),
        { status: 400, headers: webhookHeaders }
      );
    }

    const bodyText = await clonedRequest.text();
    console.log(`Webhook received - Signature: ${sig.substring(0, 20)}...`);
    console.log(`Webhook body length: ${bodyText.length} bytes`);

    // 2) Verify and parse the webhook
    const stripe = getStripe(env);
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        bodyText,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      );
      console.log(`Webhook verified, event type: ${event.type}`);
    } catch (verifyError: any) {
      console.error(`Webhook verification failed: ${verifyError.message}`);
      return new Response(
        JSON.stringify({ error: `Webhook verification failed: ${verifyError.message}` }),
        { status: 400, headers: webhookHeaders }
      );
    }

    // 3) Handle different event types
    switch (event.type) {
      case 'customer.created': {
        const customer = event.data.object as Stripe.Customer;
        const email = normalizeEmail(customer.email || "");
        const name = customer.name || "";

        if (email) {
          console.log(`Processing new customer: ${email}`);
          const result = await env.DB.prepare(
            `INSERT INTO users
               (email, name, password_hash, stripe_customer_id)
             SELECT ?, ?, '', ?
             WHERE NOT EXISTS (
               SELECT 1 FROM users WHERE lower(email)=?
             )`
          )
            .bind(email, name, customer.id, email)
            .run();

          console.log(`Customer processing result: ${result.success ? 'success' : 'no change'}`);
        } else {
          console.log(`Customer created without email, skipping user creation`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice paid: ${invoice.id}`);

        // Update service status in database if it exists
        if (invoice.customer && typeof invoice.customer === 'string') {
          const { results } = await env.DB.prepare(
            `UPDATE services
             SET status = 'paid'
             WHERE stripe_invoice_id = ?
             RETURNING id`
          )
            .bind(invoice.id)
            .all();

          console.log(`Updated ${results.length} services to paid status`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Invoice payment failed: ${invoice.id}`);

        // Log the failure but don't change service status
        if (invoice.customer && typeof invoice.customer === 'string') {
          console.log(`Payment failed for customer: ${invoice.customer}`);
        }
        break;
      }

      default: {
        console.log(`Unhandled webhook event type: ${event.type}`);
      }
    }

    // 4) Return a 200 success to Stripe
    console.log(`Successfully processed webhook event`);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: webhookHeaders,
    });
  } catch (err: any) {
    // Log the error for debugging
    console.error(`Webhook Error: ${err.message}`);
    if (err.stack) console.error(err.stack);

    // Return a 400 error to Stripe
    return new Response(
      JSON.stringify({
        error: `Webhook Error: ${err.message}`
      }),
      { status: 400, headers: webhookHeaders }
    );
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
