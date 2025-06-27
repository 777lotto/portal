/**
 * NEW FILE
 * ----------
 * This file defines a base environment interface to be shared across backend workers.
 * Cloudflare-specific types are set to `unknown` to prevent breaking the frontend build,
 * which also uses this shared package but doesn't have access to worker types.
 * Individual workers can then cast these properties to their specific types.
 */
export interface BaseEnv {
  DB: unknown;
  SESSION_KV: unknown;
  NOTIFICATION_QUEUE: unknown;
  PAYMENT_QUEUE: unknown;
  RESEND_API_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_PHONE_NUMBER: string;
  TURNSTILE_SECRET_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  STRIPE_API_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID: string;
  API_SECRET: string;
}
