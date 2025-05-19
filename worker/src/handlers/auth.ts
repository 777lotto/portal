// worker/src/handlers/auth.ts
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
    // parse & normalize
    const data = await request.json() as any;
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

// More auth handlers here...
export async function handleSignup(request: Request, env: Env): Promise<Response> {
  try {
    // parse & normalize payload
    const data = await request.json() as any;
    const email = data.email ? normalizeEmail(data.email) : "";
    const phone = data.phone ? data.phone.trim() : "";
    const name = data.name;
    const password = data.password;
    const password_hash = await hashPassword(password);

    // Implementation details...
    
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

    // issue JWT
    const token = await createJwtToken({ 
      id: user.id,
      email: user.email || null, 
      name: user.name,
      phone: user.phone || null
    }, env.JWT_SECRET);

    return new Response(JSON.stringify({ token }), {
      headers: CORS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  try {
    // Implementation details...
    const data = await request.json() as any;
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

    // Fetch user and verify credentials
    // ...

    // Issue JWT
    // ...

    return new Response(JSON.stringify({ token: "generated-token" }), {
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
