
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
import { handleIncomingSMS, sendSMS } from "./sms";

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

async function validateTurnstileToken(token: string, ip: string, env: Env): Promise<boolean> {
  if (!token) return false;

  try {
    // Get your secret key from your environment variables
    const turnstileSecretKey = env.TURNSTILE_SECRET_KEY;

    // Make a request to the Turnstile verification API
    const formData = new FormData();
    formData.append('secret', turnstileSecretKey);
    formData.append('response', token);
    formData.append('remoteip', ip);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });

    const outcome = await result.json();
    return outcome.success === true;
  } catch (error) {
    console.error('Turnstile validation error:', error);
    return false;
  }
}

async function requireAuth(request: Request, env: Env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) throw new Error("Missing token");

 try {
  const { payload } = await jwtVerify(
    auth.slice(7),
    getJwtSecretKey(env.JWT_SECRET)
  );

  if (!payload.email) {
      throw new Error("Invalid token payload");
    }

  return payload.email as string;
} catch (error: any) {
    console.error("JWT Verification error:", error);
    // Add more specific error types for debugging
    if (error.code === 'ERR_JWS_INVALID') {
      throw new Error("Invalid token format");
    } else if (error.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      throw new Error("Token signature verification failed");
    } else {
      throw new Error("Authentication failed");
    }
  }
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

    // 1. ---------- Signup ----------
// ─── Check if email exists as a Stripe customer ────────────────────────
if (request.method === "POST" && url.pathname === "/api/stripe/check-customer") {
  try {
    const { email, phone } = await request.json();
    if (!email && !phone) {
      throw new Error("At least one identifier (email or phone) is required");
    }

    // First check if the user already exists in our DB
    // Check for existing users in our DB first
let dbUser = null;
if (email) {
  dbUser = await env.DB.prepare(
    `SELECT stripe_customer_id, name, email, phone FROM users WHERE lower(email) = ?`
  ).bind(email.toLowerCase()).first();
}

// If not found by email, try phone
if (!dbUser && phone) {
  dbUser = await env.DB.prepare(
    `SELECT stripe_customer_id, name, email, phone FROM users WHERE phone = ?`
  ).bind(phone).first();
}

if (dbUser && dbUser.stripe_customer_id) {
  // User exists in our database with a Stripe ID
  return new Response(JSON.stringify({
    exists: true,
    name: dbUser.name || "",
    email: dbUser.email || "",
    phone: dbUser.phone || ""
  }), {
    status: 200,
    headers: CORS,
  });
}

    // Check if user exists in Stripe directly
    const stripe = getStripe(env);
    let customer = null;
    
    // Try to find by email first
    if (email) {
      const emailCustomers = await stripe.customers.list({
        email: email.toLowerCase(),
        limit: 1,
      });
      
      if (emailCustomers.data.length > 0) {
        customer = emailCustomers.data[0];
      }
    }
    
    // If not found by email, try phone
    if (!customer && phone) {
      // Stripe doesn't directly allow searching by phone, so we need to list and filter
      // This might not be efficient for large customer bases
      const phoneCustomers = await stripe.customers.list({
        limit: 100,
      });
      
      customer = phoneCustomers.data.find(c => c.phone === phone);
    }

    if (customer) {
      // Customer exists in Stripe
      return new Response(JSON.stringify({
        exists: true,
        name: customer.name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        stripe_customer_id: customer.id
      }), {
        status: 200,
        headers: CORS,
      });
    }

    // User doesn't exist in Stripe
    return new Response(JSON.stringify({
      exists: false
    }), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    console.error("Stripe customer check error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

// 2. ─── Create a new Stripe customer ────────────────────────────────────────
if (request.method === "POST" && url.pathname === "/api/stripe/create-customer") {
  try {
    const { email, name, phone } = await request.json();
    if ((!email && !phone) || !name) {
      throw new Error("Name and either email or phone are required");
    }

    // Create customer in Stripe
    const stripe = getStripe(env);
    const customer = await stripe.customers.create({
      ...(email ? { email: email.toLowerCase() } : {}),
      name: name,
      ...(phone ? { phone: phone } : {}),
      metadata: {
        source: "portal_signup"
      }
    });

    return new Response(JSON.stringify({
      success: true,
      customer_id: customer.id
    }), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    console.error("Stripe customer creation error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

// 3. --------- Check email for signup && return existing name --------------
if (request.method === "POST" && url.pathname === "/api/signup/check") {
  try {
    // parse & normalize
    const raw = await request.json();
    const email = normalizeEmail(raw.email);
    const phone = raw.phone ? raw.phone.trim() : "";
    const turnstileToken = raw.turnstileToken;
    const clientIp = request.headers.get('CF-Connecting-IP') || '';

   // Validate at least one identifier
    if (!email && !phone) {
      return new Response(
        JSON.stringify({ error: "Email address or phone number is required" }), 
        { status: 400, headers: CORS }
      );
    }

  // Validate turnstile
     const isValid = await validateTurnstileToken(turnstileToken, clientIp, env);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Security check failed. Please try again." }),
        { status: 400, headers: CORS }
      );
    }

 // lookup existing user by email or phone
    let existingUser = null;
    
    if (email) {
      existingUser = await env.DB.prepare(
        `SELECT password_hash, name, phone
           FROM users
          WHERE lower(email) = ?`
      ).bind(email).first();
    }
    
    // If not found by email, try phone
    if (!existingUser && phone) {
      existingUser = await env.DB.prepare(
        `SELECT password_hash, name, email
           FROM users
          WHERE phone = ?`
      ).bind(phone).first();
    }

    if (existingUser) {
      if (!existingUser.password_hash) {
 // imported user, no password yet
        return new Response(
          JSON.stringify({ 
            status: "existing", 
            name: existingUser.name,
            email: existingUser.email || email,
            phone: existingUser.phone || phone 
          }),
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

// 4. ─── Complete signup or create new ─────────────────────────────
    if (request.method === "POST" && url.pathname === "/api/signup") {
      try {
    // parse & normalize payload
        const raw = await request.json();
        const email = normalizeEmail(raw.email);
        const phone = raw.phone ? raw.phone.trim() : "";
        const name = raw.name;
        const password = raw.password;
        const password_hash = await bcrypt.hash(password, 10);

  // First check if user exists in database
    let existingUser = null;

    if (email) {
      existingUser = await env.DB.prepare(
        `SELECT id, password_hash, stripe_customer_id, phone
         FROM users
         WHERE lower(email) = ?`
      ).bind(email.toLowerCase()).first();
    }

    // If not found by email, try phone
    if (!existingUser && phone) {
      existingUser = await env.DB.prepare(
        `SELECT id, password_hash, stripe_customer_id, email
         FROM users
         WHERE phone = ?`
      ).bind(phone).first();
    }

    if (existingUser) {
      if (!existingUser.password_hash) {
        // finish setting up imported user
        await env.DB.prepare(
          `UPDATE users
           SET name = ?, password_hash = ?
           ${email ? ", email = ?" : ""}
           ${phone ? ", phone = ?" : ""}
           WHERE id = ?`
        ).bind(
          ...[
            name, 
            password_hash,
            ...(email ? [email] : []),
            ...(phone ? [phone] : []),
            existingUser.id
          ]
        ).run();

        // sync data to Stripe if customer exists
        if (existingUser.stripe_customer_id) {
          const stripe = getStripe(env);
          await stripe.customers.update(existingUser.stripe_customer_id, {
            name,
            ...(email ? { email } : {}),
            ...(phone ? { phone } : {})
        });
      }
    } else {
      throw new Error("Account already exists");
    }
  } else {
    // Check if user exists in Stripe
    let stripeCustomerId = null;
    const stripe = getStripe(env);
    
    // Try to find by email first
    let stripeCustomer = null;
    if (email) {
      const emailCustomers = await stripe.customers.list({
        email: email.toLowerCase(),
        limit: 1,
      });
      
      if (emailCustomers.data.length > 0) {
        stripeCustomer = emailCustomers.data[0];
      }
    }
    
    // If not found by email, try phone
    if (!stripeCustomer && phone) {
      const phoneCustomers = await stripe.customers.list({
        limit: 100,
      });
      
      stripeCustomer = phoneCustomers.data.find(c => c.phone === phone);
    }
    
    if (stripeCustomer) {
      // Customer exists in Stripe, update their info
      stripeCustomerId = stripeCustomer.id;
      await stripe.customers.update(stripeCustomerId, {
        name,
        ...(email && !stripeCustomer.email ? { email } : {}),
        ...(phone && !stripeCustomer.phone ? { phone } : {})
      });
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        name,
        metadata: {
          source: "portal_signup"
        }
      });
      stripeCustomerId = customer.id;
    }

    // Create user in our database
    await env.DB.prepare(
      `INSERT INTO users (email, name, password_hash, stripe_customer_id, phone)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(email || null, name, password_hash, stripeCustomerId, phone || null).run();
  }

  // Find the user to get complete info for JWT
  let user;
  if (email) {
    user = await env.DB.prepare(
      `SELECT id, email, name, phone FROM users WHERE email = ?`
    ).bind(email).first();
  } else {
    user = await env.DB.prepare(
      `SELECT id, email, name, phone FROM users WHERE phone = ?`
    ).bind(phone).first();
  }

  // issue JWT
  const token = await new SignJWT({ 
    id: user.id,
    email: user.email || null, 
    name: user.name,
    phone: user.phone || null
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getJwtSecretKey(env.JWT_SECRET));

  return new Response(JSON.stringify({ token }), {
    headers: CORS,
  });

// 5. ─── Password Reset Request ────────────────────────────────────────────
if (request.method === "POST" && url.pathname === "/api/password-reset/request") {
  try {
    const { email } = await request.json();
    if (!email) {
      throw new Error("Email is required");
    }

  // Check if user exists
    const user = await env.DB.prepare(
      `SELECT id, email, name FROM users WHERE lower(email) = ?`
    ).bind(email.toLowerCase()).first();

    if (!user) {
  // Don't reveal if user exists or not for security
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: CORS,
      });
    }

  // Generate reset token (valid for 1 hour)
    const resetToken = await new SignJWT({
      email: user.email,
      purpose: "password_reset"
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(getJwtSecretKey(env.JWT_SECRET));

  // In a real app, you would send an email here with a link like:
  // https://yourdomain.com/reset-password?token={resetToken}

  // For now, just log it
    console.log(`Reset token for ${email}: ${resetToken}`);

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

// 6. ─── Password Reset Completion ─────────────────────────────────────────
if (request.method === "POST" && url.pathname === "/api/password-reset/complete") {
  try {
    const { token, newPassword } = await request.json();
    if (!token || !newPassword) {
      throw new Error("Token and new password are required");
    }

  // Verify token
    try {
      const { payload } = await jwtVerify(
        token,
        getJwtSecretKey(env.JWT_SECRET)
      );

      if (payload.purpose !== "password_reset" || !payload.email) {
        throw new Error("Invalid reset token");
      }

  // Hash new password
      const password_hash = await bcrypt.hash(newPassword, 10);

  // Update user password
      const { changes } = await env.DB.prepare(
        `UPDATE users SET password_hash = ? WHERE lower(email) = ?`
      ).bind(password_hash, payload.email.toLowerCase()).run();

      if (changes === 0) {
        throw new Error("User not found");
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: CORS,
      });
    } catch (verifyError) {
      console.error("Token verification error:", verifyError);
      throw new Error("Invalid or expired reset token");
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}


// 7. ---------- Login ----------
if (request.method === "POST" && url.pathname === "/api/login") {
  try {
    // 1) parse & normalize payload
    const raw = await request.json();
    const identifier = raw.identifier.trim();
    const password = raw.password;
    const turnstileToken = raw.turnstileToken;

    const clientIp = request.headers.get('CF-Connecting-IP') || '';
    const isValid = await validateTurnstileToken(turnstileToken, clientIp, env);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Security check failed. Please try again." }),
        { status: 400, headers: CORS }
      );
    }


  // 2) fetch user by lowercased email
    const isEmail = identifier.includes('@');

  // 3) validate credentials
    let query;
    let bindValue;
    
    if (isEmail) {
      // Looks like an email address
      query = `SELECT id, email, name, phone, password_hash FROM users WHERE lower(email) = ?`;
      bindValue = identifier.toLowerCase();
    } else {
      // Treat as phone number
      query = `SELECT id, email, name, phone, password_hash FROM users WHERE phone = ?`;
      bindValue = identifier;
    }
    
    const { results: loginResults } = await env.DB.prepare(query)
      .bind(bindValue)
      .all();

  // 4) issue JWT
    if (loginResults.length === 0) {
      throw new Error("Invalid credentials");
    }
    
    const user = loginResults[0];
    if (!(await bcrypt.compare(password, user.password_hash))) {
      throw new Error("Invalid credentials");
    }

  // 5) issue JWT with all user info
      const token = await new SignJWT({ 
        id: user.id,
        email: user.email, 
        name: user.name,
        phone: user.phone 
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("24h")
        .sign(getJwtSecretKey(env.JWT_SECRET));

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

// 8. ─── Profile ─────────────────────────────────────────
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

// 9. ─── List services ───────────────────────────────────
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

// 10. ─── Get single service ───────────────────────────────
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

// 11. ─── Job Endpoints ─────────────────────────────────────
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


// 12. ─── Stripe Customer Portal ────────────────────────────────────────────
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

  // if we ever fail to get a URL, bail early
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


// 13. ─── Stripe webhook handler ─────────────────────────────────────────────
if (request.method === "POST" && url.pathname === "/stripe/webhook") {
  // Create a clone of the request to ensure we can read the body
  const clonedRequest = request.clone();

  // Webhook requests don't need CORS headers
  const webhookHeaders = {
    "Content-Type": "application/json"
  };

  try {
  // Grab signature & raw body
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

  // Verify and parse the webhook
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

  // Handle different event types
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

  // Mark payment reminders as paid via the payment worker
    for (const result of results) {
      try {
  // Call the payment worker to mark the reminder as paid
        await env.PAYMENT_WORKER.fetch(
          new Request('https://portal.777.foo/api/payment/mark-paid', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer internal',
            },
            body: JSON.stringify({ serviceId: result.id })
          })
        );
      } catch (err) {
        console.error(`Failed to mark payment reminder as paid: ${err}`);
      }
    }
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

// Add customer.updated case to webhook handler
  case 'customer.updated': {
  const customer = event.data.object as Stripe.Customer;
  console.log(`Customer updated: ${customer.id}`);
  
  if (!customer.id) {
    console.error("Missing customer ID in customer.updated event");
    break;
  }
  
  // Find the user by stripe_customer_id
  const user = await env.DB.prepare(
    `SELECT id, email, name, phone FROM users WHERE stripe_customer_id = ?`
  ).bind(customer.id).first();
  
  if (!user) {
    console.log(`No user found with stripe_customer_id: ${customer.id}`);
    break;
  }
  
  // Determine which fields to update
  const updates = [];
  const params = [];
  
  if (customer.email) {
    updates.push("email = ?");
    params.push(customer.email);
  }
  
  if (customer.name) {
    updates.push("name = ?");
    params.push(customer.name);
  }
  
  if (customer.phone) {
    updates.push("phone = ?");
    params.push(customer.phone);
  }
  
  if (updates.length === 0) {
    console.log("No fields to update");
    break;
  }
  
  // Add customer ID as the last parameter
  params.push(customer.id);
  
  // Update user record
  try {
    const result = await env.DB.prepare(
      `UPDATE users SET ${updates.join(", ")} WHERE stripe_customer_id = ?`
    ).bind(...params).run();
    
    console.log(`Updated user from Stripe data. Changes: ${result.changes}`);
  } catch (err) {
    console.error(`Error updating user from Stripe data: ${err}`);
  }
  
  break;
}

      default: {
        console.log(`Unhandled webhook event type: ${event.type}`);
      }
    }

  // Return a 200 success to Stripe
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

// 14. ─── SMS webhook endpoint ───────────────────────────────────────────
if (request.method === "POST" && url.pathname === "/api/sms/webhook") {
  // Forward directly to notification worker without auth (it's a public webhook)
  return env.NOTIFICATION_WORKER.fetch(
    new Request('https://portal.777.foo/api/notifications/sms/webhook', {
      method: 'POST',
      headers: request.headers,
      body: request.body
    })
  );
}

  // ─── SMS endpoints requiring auth ───────────────────────────────────────────
  if (
    (request.method === "GET" && url.pathname === "/api/sms/conversations") ||
    (request.method === "GET" && url.pathname.match(/^\/api\/sms\/messages\/\+?[0-9]+$/)) ||
    (request.method === "POST" && url.pathname === "/api/sms/send")
  ) {
    try {
      // Authenticate the request
      const email = await requireAuth(request, env);

      // Get the user's ID
      const user = await env.DB.prepare(
        `SELECT id FROM users WHERE email = ?`
      ).bind(email).first();

      if (!user) {
        throw new Error("User not found");
      }

      // Create the forwarded URL with userId added as a query param
      const forwardUrl = new URL(
        `https://portal.777.foo/api/notifications${url.pathname.replace('/api', '')}`
      );
      forwardUrl.searchParams.append('userId', user.id.toString());

      // Copy any existing query params
      url.searchParams.forEach((value, key) => {
        forwardUrl.searchParams.append(key, value);
      });

      // For POST requests, need to add userId to the body
      if (request.method === "POST") {
        const originalBody = await request.json();

        // Create a new request with userId added to body
        return await env.NOTIFICATION_WORKER.fetch(
          new Request(forwardUrl.toString(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': request.headers.get('Authorization') || '',
            },
            body: JSON.stringify({
              ...originalBody,
              userId: user.id
            })
          })
        );
      } else {
        // For GET requests, just forward with the updated URL
        return await env.NOTIFICATION_WORKER.fetch(
          new Request(forwardUrl.toString(), {
            method: 'GET',
            headers: {
              'Authorization': request.headers.get('Authorization') || '',
            }
          })
        );
      }
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 401,
        headers: CORS,
      });
    }
  }

// 15. ─── Payment service endpoint proxy ───────────────────────────────────────────
if (request.method === "POST" && url.pathname.startsWith("/api/payment/")) {
  try {
    // Authenticate the request
    const email = await requireAuth(request, env);

    // Forward the authenticated request to the payment worker
    return await env.PAYMENT_WORKER.fetch(request);
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 401,
      headers: CORS,
    });
  }
}

// ---------- Fallback ----------
    return new Response("Not found", {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
} satisfies ExportedHandler<Env>;
