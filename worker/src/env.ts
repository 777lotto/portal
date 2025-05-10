// worker/src/env.ts
import { D1Database } from '@cloudflare/workers-types';

export interface Env {
  // D1 Database
  DB: D1Database;

  // Secrets
  JWT_SECRET: string;

  // Stripe
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
}
