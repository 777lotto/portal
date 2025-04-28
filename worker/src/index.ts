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

    // Handle CORS Preflight
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

    // --- Ping route
    if (request.method === "GET" && url.pathname === "/api/ping") {
      return new Response(JSON.stringify({ message: "pong" }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // --- Signup route
    if (request.method === "POST" && url.pathname === "/api/signup") {
      try {
        const { email, name, password } = await request.json();

        const password_hash = await bcrypt.hash(password, 10);

        await env.DB.prepare(
          `INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)`
        )
          .bind(email, name, password_hash)
          .run();

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: "Signup failed" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // --- Login route
    if (request.method === "POST" && url.pathname === "/api/login") {
      try {
        const { email, password } = await request.json();

        const { results } = await env.DB.prepare(
          `SELECT id, email, name, password_hash FROM users WHERE email = ?`
        )
          .bind(email)
          .all();

        if (results.length === 0) {
          throw new Error("Invalid credentials");
        }

        const user = results[0];
        const passwordsMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordsMatch) {
          throw new Error("Invalid credentials");
        }

        const token = await new SignJWT({ email: user.email, name: user.name })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("2h")
          .sign(getJwtSecretKey(env.JWT_SECRET)); // 🔥 fixed here

        return new Response(JSON.stringify({ token }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });

      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Login failed" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // --- Profile route
    if (request.method === "GET" && url.pathname === "/api/profile") {
      try {
        const auth = request.headers.get("Authorization") || "";
        if (!auth.startsWith("Bearer ")) {
          throw new Error("Missing token");
        }

        const token = auth.slice(7);

        const { payload } = await jwtVerify(token, getJwtSecretKey(env.JWT_SECRET)); // 🔥 fixed here

        const email = payload.email as string;

        const { results } = await env.DB.prepare(
          `SELECT id, email, name FROM users WHERE email = ?`
        )
          .bind(email)
          .all();

        if (results.length === 0) {
          throw new Error("User not found");
        }

        return new Response(JSON.stringify(results[0]), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });

      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Profile failed" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // --- fallback
    return new Response("Not found", {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
