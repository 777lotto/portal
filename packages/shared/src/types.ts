// packages/shared/src/types.ts - Cleaned, organized, and corrected

import { z } from 'zod';

/* ========================================================================
   1. ENVIRONMENT & CLOUDFLARE TYPES
   ======================================================================== */

/**
 * Defines all environment variables and bindings available across all workers.
 * This is the single source of truth for your environment configuration.
 */
export interface Env {
  // D1 Database Binding (available to all)
  DB: D1Database;

  // Secrets (available to all)
  JWT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  CF_IMAGES_ACCOUNT_HASH: string;
  CF_IMAGES_API_TOKEN: string;

  // Configuration Variables
  PORTAL_URL: string; // URL for redirecting from Stripe Portal
  ENVIRONMENT?: 'development' | 'production';
}

// Boilerplate types for D1
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T[]>>;
}
export interface D1Result<T = unknown> {
  results?: T;
  success: boolean;
  error?: string;
  meta: any;
}


/* ========================================================================
   2. DATABASE MODEL SCHEMAS & TYPES
   ======================================================================== */

export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  phone: z.string().nullable(),
  role: z.enum(['customer', 'admin']),
  stripe_customer_id: z.string().optional().nullable(),
});
export type User = z.infer<typeof UserSchema>;

export const ServiceSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  service_date: z.string(),
  status: z.string(),
  notes: z.string().optional().nullable(),
  price_cents: z.number().optional().nullable(),
  stripe_invoice_id: z.string().optional().nullable(),
});
export type Service = z.infer<typeof ServiceSchema>;

export const JobSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  start: z.string(),
  end: z.string(),
  status: z.string(),
});
export type Job = z.infer<typeof JobSchema>;

export const PhotoSchema = z.object({
    id: z.string(),
    url: z.string().url(),
    created_at: z.string(),
});
export type Photo = z.infer<typeof PhotoSchema>;

export const NoteSchema = z.object({
    id: z.number(),
    content: z.string(),
    created_at: z.string(),
});
export type Note = z.infer<typeof NoteSchema>;


/* ========================================================================
   3. API & AUTHENTICATION TYPES
   ======================================================================== */

export const AuthResponseSchema = z.object({
    token: z.string(),
    user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const PortalSessionSchema = z.object({
    url: z.string().url(),
});
export type PortalSession = z.infer<typeof PortalSessionSchema>;

export const SMSMessageSchema = z.object({
    id: z.number().optional(), // Make optional as it might not exist on new messages
    direction: z.enum(['incoming', 'outgoing']),
    message: z.string(),
    created_at: z.string(),
});
export type SMSMessage = z.infer<typeof SMSMessageSchema>;

export const ConversationSchema = z.object({
    phone_number: z.string(),
    last_message_at: z.string(),
    message_count: z.number(),
    // Add any other fields you need
});
export type Conversation = z.infer<typeof ConversationSchema>;

