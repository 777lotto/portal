// worker/src/index.ts
import { Env } from "@portal/shared";
import { handleCorsPreflightRequest, CORS, errorResponse } from "./utils";
import { requireAuth } from "./auth";
import * as authHandlers from "./handlers/auth";
import * as stripeHandlers from "./handlers/stripe";
import * as jobHandlers from "./handlers/jobs";
import * as profileHandlers from "./handlers/profile";
import * as serviceHandlers from "./handlers/services";
import { handleIncomingSMS } from "./sms";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return handleCorsPreflightRequest();
    }

    try {
      // --- Public endpoints (no auth required) ---
      
      // Health check
      if (request.method === "GET" && path === "/api/ping") {
        return new Response(JSON.stringify({ message: "pong" }), {
          headers: { "Content-Type": "application/json", ...CORS }
        });
      }

      // --- Auth endpoints ---
      
      // Signup check
      if (request.method === "POST" && path === "/api/signup/check") {
        return await authHandlers.handleSignupCheck(request, env);
      }
      
      // Complete signup
      if (request.method === "POST" && path === "/api/signup") {
        return await authHandlers.handleSignup(request, env);
      }
      
      // Login
      if (request.method === "POST" && path === "/api/login") {
        return await authHandlers.handleLogin(request, env);
      }
      
      // Password reset request
      if (request.method === "POST" && path === "/api/password-reset/request") {
        return await authHandlers.handlePasswordResetRequest(request, env);
      }
      
      // Password reset completion
      if (request.method === "POST" && path === "/api/password-reset/complete") {
        return await authHandlers.handlePasswordResetComplete(request, env);
      }

      // --- Stripe endpoints ---
      
      // Check if customer exists in Stripe
      if (request.method === "POST" && path === "/api/stripe/check-customer") {
        return await stripeHandlers.handleStripeCustomerCheck(request, env);
      }
      
      // Create a new Stripe customer
      if (request.method === "POST" && path === "/api/stripe/create-customer") {
        return await stripeHandlers.handleStripeCreateCustomer(request, env);
      }
      
      // Stripe webhook (incoming webhooks from Stripe)
      if (request.method === "POST" && path === "/stripe/webhook") {
        return await stripeHandlers.handleStripeWebhook(request, env);
      }
      
      // Customer portal session
      if (request.method === "POST" && path === "/api/portal") {
        // This requires auth
        try {
          const email = await requireAuth(request, env);
          return await stripeHandlers.handleStripePortal(request, env, email);
        } catch (err: any) {
          return errorResponse(err.message, 401);
        }
      }
      
      // --- Profile endpoints ---
      
      // Get user profile
      if (request.method === "GET" && path === "/api/profile") {
        try {
          const email = await requireAuth(request, env);
          return await profileHandlers.handleGetProfile(request, env, email);
        } catch (err: any) {
          return errorResponse(err.message, 401);
        }
      }
      
      // Update user profile
      if (request.method === "PUT" && path === "/api/profile") {
        try {
          const email = await requireAuth(request, env);
          return await profileHandlers.handleUpdateProfile(request, env, email);
        } catch (err: any) {
          return errorResponse(err.message, 401);
        }
      }
      
      // --- Service endpoints ---
      
      // List all services
      if (request.method === "GET" && path === "/api/services") {
        try {
          const email = await requireAuth(request, env);
          return await serviceHandlers.handleListServices(request, env, email);
        } catch (err: any) {
          return errorResponse(err.message, 401);
        }
      }
      
      // Get a specific service
      if (request.method === "GET" && path.match(/^\/api\/services\/\d+$/)) {
        try {
          const email = await requireAuth(request, env);
          const id = parseInt(path.split("/").pop()!, 10);
          return await serviceHandlers.handleGetService(request, env, email, id);
        } catch (err: any) {
          return errorResponse(err.message, 401);
        }
      }
      
      // Get invoice for a service
      if (request.method === "GET" && path.match(/^\/api\/services\/\d+\/invoice$/)) {
        try {
          const email = await requireAuth(request, env);
          const serviceId = parseInt(path.split("/")[3], 10);
          return await serviceHandlers.handleGetInvoice(request, env, email, serviceId);
        } catch (err: any) {
          return errorResponse(err.message, 401);
        }
      }

      // Create invoice for a service
      if (request.method === "POST" && path.match(/^\/api\/services\/\d+\/invoice$/)) {
        try {
          const email = await requireAuth(request, env);
          const serviceId = parseInt(path.split("/")[3], 10);
          return await serviceHandlers.handleCreateInvoice(request, env, email, serviceId);
        } catch (err: any) {
          return errorResponse(err.message, 401);
        }
      }
      
      // --- Job endpoints ---
      
      // Get all jobs
      if (request.method === "GET" && path === "/api/jobs") {
        try {
          const email = await requireAuth(request, env);
          return await jobHandlers.handleGetJobs(request, env, email);
        } catch (err: any) {
          return errorResponse(err.message, 401);
        }
      }
      
      // Get a specific job
      if (request.method === "GET" && path.match(/^\/api\/jobs\/[a-f0-9-]+$/)) {
        try {
          const email = await requireAuth(request, env);
          return await jobHandlers.handleGetJobById(request, url, env, email);
        } catch (err: any) {
          const status = err.message === "Job not found" ? 404 : 401;
          return errorResponse(err.message, status);
        }
      }
      
      // Calendar feed for clients (uses token auth instead of JWT)
      if (request.method === "GET" && path === "/api/calendar-feed") {
        return await jobHandlers.handleCalendarFeed(request, url, env);
      }
      
      // --- SMS endpoints ---
      
      // SMS webhook
      if (request.method === "POST" && path === "/api/sms/webhook") {
        return await env.NOTIFICATION_WORKER.fetch(
          new Request('https://portal.777.foo/api/notifications/sms/webhook', {
            method: 'POST',
            headers: request.headers,
            body: request.body
          })
        );
      }
      
      // Get SMS conversations
      if (request.method === "GET" && path === "/api/sms/conversations") {
        try {
          const email = await requireAuth(request, env);
          const user = await env.DB.prepare(
            `SELECT id FROM users WHERE email = ?`
          ).bind(email).first();
          
          if (!user) {
            throw new Error("User not found");
          }
          
          const forwardUrl = new URL(
            `https://portal.777.foo/api/notifications/sms/conversations`
          );
          forwardUrl.searchParams.append('userId', (user as any).id.toString());
          
          return await env.NOTIFICATION_WORKER.fetch(
            new Request(forwardUrl.toString(), {
              method: 'GET',
              headers: {
                'Authorization': request.headers.get('Authorization') || '',
              }
            })
          );
        } catch (err: any) {
          return errorResponse(err.message, 401);
        }
      }
      
      // Get SMS messages for a conversation
      if (request.method === "GET" && path.match(/^\/api\/sms\/messages\/\+?[0-9]+$/)) {
        try {
          const email = await requireAuth(request, env);
          const phoneNumber = path.split('/').pop()!;
          
          const user = await env.DB.prepare(
            `SELECT id FROM users WHERE email = ?`
          ).bind(email).first();
          
          if (!user) {
            throw new Error("User not found");
          }
          
          const forwardUrl = new URL(
            `https://portal.777.foo/api/notifications/sms/messages/${phoneNumber}`
          );
          forwardUrl.searchParams.append('userId', (user as any).id.toString());
          
          return await env.NOTIFICATION_WORKER.fetch(
            new Request(forwardUrl.toString(), {
              method: 'GET',
              headers: {
                'Authorization': request.headers.get('Authorization') || '',
              }
            })
          );
        } catch (err: any) {
          return errorResponse(err.message, 401);
        }
      }
      
      // Send SMS
      if (request.method === "POST" && path === "/api/sms/send") {
        try {
          const email = await requireAuth(request, env);
          const originalBody = await request.json() as any;
          
          const user = await env.DB.prepare(
            `SELECT id FROM users WHERE email = ?`
          ).bind(email).first();
          
          if (!user) {
            throw new Error("User not found");
          }
          
          return await env.NOTIFICATION_WORKER.fetch(
            new Request('https://portal.777.foo/api/notifications/sms/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': request.headers.get('Authorization') || '',
              },
              body: JSON.stringify({
                ...originalBody,
                userId: (user as any).id
              })
            })
          );
        } catch (err: any) {
          return errorResponse(err.message, 401);
        }
      }
      
      // --- Payment service proxy ---
      
      if (request.method === "POST" && path.startsWith("/api/payment/")) {
        try {
          const email = await requireAuth(request, env);
          // Forward the authenticated request to the payment worker
          return await env.PAYMENT_WORKER.fetch(request);
        } catch (err: any) {
          return errorResponse(err.message, 401);
        }
      }

      // Fallback for unhandled routes
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: CORS,
      });
    } catch (error: any) {
      console.error("Unhandled error:", error);
      return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
        status: 500,
        headers: CORS,
      });
    }
  },
};
