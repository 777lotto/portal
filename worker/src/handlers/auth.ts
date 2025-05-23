// worker/src/handlers/auth.ts - Enhanced with debug logging
import { Env, User } from "@portal/shared";
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
    console.log('=== SIGNUP CHECK START ===');
    
    // parse & normalize
    const data = await request.json() as any;
    console.log('Request data:', { 
      email: data.email, 
      phone: data.phone,
      hasTurnstileToken: !!data.turnstileToken 
    });
    
    const email = data.email ? normalizeEmail(data.email) : "";
    const phone = data.phone ? data.phone.trim() : "";
    const turnstileToken = data.turnstileToken;
    const clientIp = request.headers.get('CF-Connecting-IP') || '';

    console.log('Normalized data:', { email, phone, clientIp });

    // Validate at least one identifier
    if (!email && !phone) {
      console.log('ERROR: No email or phone provided');
      return new Response(
        JSON.stringify({ error: "Email address or phone number is required" }), 
        { status: 400, headers: CORS }
      );
    }

    // Validate turnstile
    console.log('Validating Turnstile token...');
    const isValid = await validateTurnstileToken(turnstileToken, clientIp, env);
    console.log('Turnstile validation result:', isValid);
    
    if (!isValid) {
      console.log('ERROR: Turnstile validation failed');
      return new Response(
        JSON.stringify({ error: "Security check failed. Please try again." }),
        { status: 400, headers: CORS }
      );
    }

    // lookup existing user by email or phone
    let existingUser = null;
    
    if (email) {
      console.log('Checking for existing user by email:', email);
      existingUser = await env.DB.prepare(
        `SELECT password_hash, name, phone
           FROM users
          WHERE lower(email) = ?`
      ).bind(email).first();
      console.log('Email lookup result:', existingUser ? 'Found' : 'Not found');
    }
    
    // If not found by email, try phone
    if (!existingUser && phone) {
      console.log('Checking for existing user by phone:', phone);
      existingUser = await env.DB.prepare(
        `SELECT password_hash, name, email
           FROM users
          WHERE phone = ?`
      ).bind(phone).first();
      console.log('Phone lookup result:', existingUser ? 'Found' : 'Not found');
    }

    if (existingUser) {
      if (!(existingUser as any).password_hash) {
        console.log('User exists but no password - imported user');
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

      console.log('User already fully signed up');
      // fully signed up already
      return new Response(
        JSON.stringify({ error: "Account already exists" }),
        { status: 400, headers: CORS }
      );
    }

    console.log('Brand new user');
    // brand‑new user
    return new Response(JSON.stringify({ status: "new" }), {
      headers: CORS,
    });
  } catch (err: any) {
    console.error('SIGNUP CHECK ERROR:', err);
    return new Response(JSON.stringify({ 
      error: err.message,
      stack: err.stack 
    }), {
      status: 500,
      headers: CORS,
    });
  }
}

// Handle signup
export async function handleSignup(request: Request, env: Env): Promise<Response> {
  try {
    console.log('=== SIGNUP START ===');
    
    // parse & normalize payload
    const data = await request.json() as any;
    console.log('Signup data:', { 
      email: data.email, 
      phone: data.phone, 
      name: data.name,
      hasPassword: !!data.password 
    });
    
    const email = data.email ? normalizeEmail(data.email) : "";
    const phone = data.phone ? data.phone.trim() : "";
    const name = data.name;
    const password = data.password;

    if (!name || !password) {
      return new Response(JSON.stringify({ error: "Name and password are required" }), {
        status: 400,
        headers: CORS,
      });
    }

    if (!email && !phone) {
      return new Response(JSON.stringify({ error: "Email or phone is required" }), {
        status: 400,
        headers: CORS,
      });
    }

    console.log('Hashing password...');
    const password_hash = await hashPassword(password);

    // Check if user already exists
    let existingUser = null;
    if (email) {
      existingUser = await env.DB.prepare(
        `SELECT id FROM users WHERE lower(email) = ?`
      ).bind(email.toLowerCase()).first();
    }
    if (!existingUser && phone) {
      existingUser = await env.DB.prepare(
        `SELECT id FROM users WHERE phone = ?`
      ).bind(phone).first();
    }

    if (existingUser) {
      console.log('User already exists');
      return new Response(JSON.stringify({ error: "User already exists" }), {
        status: 400,
        headers: CORS,
      });
    }

    // Create user
    console.log('Creating new user...');
    const result = await env.DB.prepare(
      `INSERT INTO users (email, name, password_hash, phone)
       VALUES (?, ?, ?, ?)`
    ).bind(email || null, name, password_hash, phone || null).run();

    console.log('User created with ID:', result.meta.last_row_id);

    // Find the user to get complete info for JWT
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

    console.log('User for JWT:', { id: user.id, email: user.email, name: user.name });

    // issue JWT
    const token = await createJwtToken({ 
      id: user.id,
      email: user.email || null, 
      name: user.name,
      phone: user.phone || null
    }, env.JWT_SECRET);

    console.log('JWT created successfully');

    return new Response(JSON.stringify({ token }), {
      headers: CORS,
    });
  } catch (err: any) {
    console.error('SIGNUP ERROR:', err);
    return new Response(JSON.stringify({ 
      error: err.message,
      stack: err.stack 
    }), {
      status: 500,
      headers: CORS,
    });
  }
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    console.log('=== LOGIN START ===');
    
    // Implementation details...
    const data = await request.json() as any;
    console.log('Login attempt for:', data.identifier);
    
    const identifier = data.identifier.trim();
    const password = data.password;
    const turnstileToken = data.turnstileToken;

    const clientIp = request.headers.get('CF-Connecting-IP') || '';
    console.log('Validating Turnstile for login...');
    const isValid = await validateTurnstileToken(turnstileToken, clientIp, env);
    
    if (!isValid) {
      console.log('Login Turnstile validation failed');
      return new Response(
        JSON.stringify({ error: "Security check failed. Please try again." }),
        { status: 400, headers: CORS }
      );
    }

    // Try to find user by email or phone
    let user: any = null;
    
    // Check if identifier looks like email
    if (identifier.includes('@')) {
      console.log('Looking up user by email');
      user = await env.DB.prepare(
        `SELECT id, email, name, phone, password_hash FROM users WHERE lower(email) = ?`
      ).bind(identifier.toLowerCase()).first();
    } else {
      console.log('Looking up user by phone');
      user = await env.DB.prepare(
        `SELECT id, email, name, phone, password_hash FROM users WHERE phone = ?`
      ).bind(identifier).first();
    }

    if (!user) {
      console.log('User not found');
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: CORS }
      );
    }

    // Verify password
    console.log('Verifying password...');
    const isValidPassword = await verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      console.log('Invalid password');
      return new Response(
        JSON.stringify({ error: "Invalid credentials" }),
        { status: 401, headers: CORS }
      );
    }

    // Issue JWT
    console.log('Creating login JWT...');
    const token = await createJwtToken({
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone
    }, env.JWT_SECRET);

    console.log('Login successful for user:', user.id);

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    console.error('LOGIN ERROR:', err);
    return new Response(JSON.stringify({ 
      error: err.message,
      stack: err.stack 
    }), {
      status: 500,
      headers: CORS,
    });
  }
}
