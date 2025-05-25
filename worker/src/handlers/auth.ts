// worker/src/handlers/auth.ts - Fixed to work with the API
import type { Env } from "../env";
import { 
  normalizeEmail, 
  validateTurnstileToken, 
  createJwtToken, 
  hashPassword,
  verifyPassword
} from "../auth";
import { getOrCreateCustomer } from "../stripe";
import { CORS } from "../utils";

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
    let existingUser = null;
    
    if (email) {
      console.log(`🔍 Checking for existing user with email: ${email}`);
      existingUser = await env.DB.prepare(
        `SELECT password_hash, name, phone
           FROM users
          WHERE lower(email) = ?`
      ).bind(email).first();
    }
    
    // If not found by email, try phone
    if (!existingUser && phone) {
      console.log(`🔍 Checking for existing user with phone: ${phone}`);
      existingUser = await env.DB.prepare(
        `SELECT password_hash, name, email
           FROM users
          WHERE phone = ?`
      ).bind(phone).first();
    }

    if (existingUser) {
      console.log('👤 Found existing user:', existingUser);
      if (!(existingUser as any).password_hash) {
        // imported user, no password yet
        return new Response(
          JSON.stringify({ 
            status: "existing", 
            name: (existingUser as any).name,
            email: (existingUser as any).email || email,
            phone: (existingUser as any).phone || phone 
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

// Handle full signup
export async function handleSignup(request: Request, env: Env): Promise<Response> {
  try {
    console.log('✍️ Processing signup...');
    
    // parse & normalize payload
    const data = await request.json() as any;
    console.log('✍️ Signup data:', data);
    
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
    console.log('🔒 Password hashed');

    // Check if user already exists
    let existingUser = null;
    if (email) {
      existingUser = await env.DB.prepare(
        `SELECT id FROM users WHERE lower(email) = ?`
      ).bind(email).first();
    }
    if (!existingUser && phone) {
      existingUser = await env.DB.prepare(
        `SELECT id FROM users WHERE phone = ?`
      ).bind(phone).first();
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

    // Get the complete user record for JWT
    let user: any = {};
    if (email) {
      user = await env.DB.prepare(
        `SELECT id, email, name, phone FROM users WHERE email = ?`
      ).bind(email).first();
    } else {
      user = await env.DB.prepare(
        `SELECT id, email, name, phone FROM users WHERE phone = ?`
      ).bind(phone).first();
    }

    if (!user) {
      throw new Error("Failed to retrieve created user");
    }

    console.log('🎫 Creating JWT token...');
    // issue JWT
    const token = await createJwtToken({ 
      id: user.id,
      email: user.email || null, 
      name: user.name,
      phone: user.phone || null
    }, env.JWT_SECRET);

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
    console.log('🔐 Login data:', data);
    
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
    let user: any;

    if (isEmail) {
      console.log(`🔍 Looking up user by email: ${identifier}`);
      user = await env.DB.prepare(
        `SELECT id, email, name, phone, password_hash FROM users WHERE lower(email) = ?`
      ).bind(identifier.toLowerCase()).first();
    } else {
      console.log(`🔍 Looking up user by phone: ${identifier}`);
      user = await env.DB.prepare(
        `SELECT id, email, name, phone, password_hash FROM users WHERE phone = ?`
      ).bind(identifier).first();
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
    // Issue JWT
    const token = await createJwtToken({
      id: user.id,
      email: user.email || null,
      name: user.name,
      phone: user.phone || null
    }, env.JWT_SECRET);

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
