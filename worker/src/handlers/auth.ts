// worker/src/handlers/auth.ts - Fixed JWT token creation and validation
import type { Env } from "@portal/shared";
import { 
  normalizeEmail, 
  validateTurnstileToken, 
  createJwtToken, 
  hashPassword,
  verifyPassword
} from "../auth";
import { getOrCreateCustomer } from "../stripe";
import { CORS, errorResponse } from "../utils"; // Make sure errorResponse is imported

interface UserRecord {
  id: number;
  email?: string;
  name: string;
  phone?: string;
  password_hash?: string;
  stripe_customer_id?: string;
}

// Handle signup check
export async function handleSignupCheck(request: Request, env: Env): Promise<Response> {
  try {
    console.log('📝 Processing signup check...');
    
    // parse & normalize
    const data = await request.json() as any;
    console.log('📝 Signup check data:', data);
    
    const email = data.email ? normalizeEmail(data.email) : "";
    const phone = data.phone ? data.phone.trim() : "";
    const turnstileToken = data.turnstileToken;
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
    let existingUser: UserRecord | null = null;
    
    if (email) {
      console.log(`🔍 Checking for existing user with email: ${email}`);
      existingUser = await env.DB.prepare(
        `SELECT password_hash, name, phone, email
           FROM users
          WHERE lower(email) = ?`
      ).bind(email).first() as UserRecord | null;
    }
    
    // If not found by email, try phone
    if (!existingUser && phone) {
      console.log(`🔍 Checking for existing user with phone: ${phone}`);
      existingUser = await env.DB.prepare(
        `SELECT password_hash, name, email, phone
           FROM users
          WHERE phone = ?`
      ).bind(phone).first() as UserRecord | null;
    }

    if (existingUser) {
      console.log('👤 Found existing user:', existingUser);
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
    console.log('✨ New user detected');
    return new Response(JSON.stringify({ status: "new" }), {
      headers: CORS,
    });
  } catch (err: any) {
    console.error('❌ Signup check error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

// Handle password reset request
export async function handleRequestPasswordReset(request: Request, env: Env): Promise<Response> {
  try {
    console.log('🔑 Processing password reset request...');

    const data = await request.json() as { email?: string; turnstileToken?: string };
    const email = data.email ? normalizeEmail(data.email) : "";
    const turnstileToken = data.turnstileToken;
    const clientIp = request.headers.get('CF-Connecting-IP') || '';

    // Validate turnstile and email
    if (!email) {
      return errorResponse("Email address is required", 400);
    }
    const isValid = await validateTurnstileToken(turnstileToken || '', clientIp, env);
    if (!isValid) {
      return errorResponse("Security check failed. Please try again.", 400);
    }

    // Find user in the database
    const user = await env.DB.prepare(
      `SELECT id, name FROM users WHERE lower(email) = ?`
    ).bind(email).first<UserRecord>();

    if (user) {
      // Generate a secure, random token
      const resetToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 3600 * 1000); // Token expires in 1 hour

      // Store the token in the database
      await env.DB.prepare(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`
      ).bind(user.id, resetToken, expiresAt.toISOString()).run();

      // Trigger notification worker to send the email
      if (env.NOTIFICATION_WORKER) {
        const resetLink = `https://portal.777.foo/reset-password?token=${resetToken}`;

        await env.NOTIFICATION_WORKER.fetch(
          new Request('https://portal.777.foo/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer worker-internal-auth' },
            body: JSON.stringify({
              type: 'password_reset',
              userId: user.id,
              data: {
                name: user.name,
                resetLink: resetLink,
              },
              channels: ['email']
            })
          })
        );
      }
    }
    // Always return a success message to prevent user enumeration
    return new Response(JSON.stringify({
      message: "If an account with that email exists, we have sent password reset instructions."
    }), { status: 200, headers: CORS });

  } catch (err: any) {
    console.error('❌ Password reset error:', err);
    // Do not leak specific errors to the client
    return errorResponse("An unexpected error occurred. Please try again later.", 500);
  }
}

// Handle full signup
export async function handleSignup(request: Request, env: Env): Promise<Response> {
  try {
    console.log('✍️ Processing signup...');
    
    // parse & normalize payload
    const data = await request.json() as any;
    console.log('✍️ Signup data:', { ...data, password: '[REDACTED]' });
    
    const email = data.email ? normalizeEmail(data.email) : "";
    const phone = data.phone ? data.phone.trim() : "";
    const name = data.name;
    const password = data.password;

    if (!name || !password) {
      return new Response(
        JSON.stringify({ error: "Name and password are required" }),
        { status: 400, headers: CORS }
      );
    }

    if (!email && !phone) {
      return new Response(
        JSON.stringify({ error: "Email or phone number is required" }),
        { status: 400, headers: CORS }
      );
    }

    const password_hash = await hashPassword(password);

    // Check if user already exists
    let existingUser: UserRecord | null = null;
    if (email) {
      existingUser = await env.DB.prepare(
        `SELECT id FROM users WHERE lower(email) = ?`
      ).bind(email).first() as UserRecord | null;
    }
    if (!existingUser && phone) {
      existingUser = await env.DB.prepare(
        `SELECT id FROM users WHERE phone = ?`
      ).bind(phone).first() as UserRecord | null;
    }

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "User already exists" }),
        { status: 400, headers: CORS }
      );
    }

    // Create user in database
    console.log('💾 Creating user in database...');
    const result = await env.DB.prepare(
      `INSERT INTO users (email, name, password_hash, phone) VALUES (?, ?, ?, ?)`
    ).bind(email || null, name, password_hash, phone || null).run();

    console.log('✅ User created with ID:', result.meta.last_row_id);

    // Create Stripe customer if we have an email
    let stripe_customer_id = null;
    if (email) {
      try {
        console.log('💳 Creating Stripe customer...');
        stripe_customer_id = await getOrCreateCustomer(env, email, name);
        
        // Update user with Stripe customer ID
        await env.DB.prepare(
          `UPDATE users SET stripe_customer_id = ? WHERE id = ?`
        ).bind(stripe_customer_id, result.meta.last_row_id).run();
        
        console.log('✅ Stripe customer created:', stripe_customer_id);
      } catch (stripeError: any) {
        console.error('❌ Stripe customer creation failed:', stripeError);
        // Continue without Stripe - user can be created later
      }
    }

    // Get the complete user record for JWT - ensure we have all fields
    const user = await env.DB.prepare(
      `SELECT id, email, name, phone FROM users WHERE id = ?`
    ).bind(result.meta.last_row_id).first() as UserRecord | null;

    if (!user) {
      throw new Error("Failed to retrieve created user");
    }

    console.log('🎫 Creating JWT token...');
    
    // Create a clean payload for JWT - ensure all fields are properly typed
    const jwtPayload = {
      id: Number(user.id), // Ensure it's a number
      email: user.email || null,
      name: user.name,
      phone: user.phone || null,
      iat: Math.floor(Date.now() / 1000) // Add issued at time
    };

    console.log('JWT payload:', jwtPayload);

    // issue JWT with explicit typing
    const token = await createJwtToken(jwtPayload, env.JWT_SECRET, "7d"); // 7 day expiry

    console.log('✅ Signup completed successfully');
    return new Response(JSON.stringify({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone
      }
    }), {
      headers: CORS,
    });
  } catch (err: any) {
    console.error('❌ Signup error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    console.log('🔐 Processing login...');
    
    const data = await request.json() as any;
    console.log('🔐 Login data:', { ...data, password: '[REDACTED]' });
    
    const identifier = data.identifier.trim();
    const password = data.password;
    const turnstileToken = data.turnstileToken;

    const clientIp = request.headers.get('CF-Connecting-IP') || '';
    const isValid = await validateTurnstileToken(turnstileToken, clientIp, env);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Security check failed. Please try again." }),
        { status: 400, headers: CORS }
      );
    }

    // Check if identifier is email or phone
    const isEmail = identifier.includes('@');
    let user: UserRecord | null;

    if (isEmail) {
      console.log(`🔍 Looking up user by email: ${identifier}`);
      user = await env.DB.prepare(
        `SELECT id, email, name, phone, password_hash FROM users WHERE lower(email) = ?`
      ).bind(identifier.toLowerCase()).first() as UserRecord | null;
    } else {
      console.log(`🔍 Looking up user by phone: ${identifier}`);
      user = await env.DB.prepare(
        `SELECT id, email, name, phone, password_hash FROM users WHERE phone = ?`
      ).bind(identifier).first() as UserRecord | null;
    }

    if (!user) {
      console.log('❌ User not found');
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: CORS }
      );
    }

    if (!user.password_hash) {
      return new Response(
        JSON.stringify({ error: "Account exists but password not set. Please contact support." }),
        { status: 401, headers: CORS }
      );
    }

    // Verify password
    console.log('🔒 Verifying password...');
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      console.log('❌ Invalid password');
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: CORS }
      );
    }

    console.log('🎫 Creating JWT token...');
    
    // Create a clean payload for JWT - ensure all fields are properly typed
    const jwtPayload = {
      id: Number(user.id), // Ensure it's a number
      email: user.email || null,
      name: user.name,
      phone: user.phone || null,
      iat: Math.floor(Date.now() / 1000) // Add issued at time
    };

    console.log('JWT payload:', jwtPayload);

    // Issue JWT with explicit typing
    const token = await createJwtToken(jwtPayload, env.JWT_SECRET, "7d"); // 7 day expiry

    console.log('✅ Login successful');
    return new Response(JSON.stringify({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone
      }
    }), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    console.error('❌ Login error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 401,
      headers: CORS,
    });
  }
}
