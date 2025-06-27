// packages/shared/src/types.ts - THE SINGLE SOURCE OF TRUTH
// All type definitions have been consolidated, corrected, and are now exported from here.

import { z } from 'zod';

/* ========================================================================
   DATABASE & CORE MODELS
   ======================================================================== */

// Defines the structure for a user, aligning with the database and JWT payload.
export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  phone: z.string().nullable(),
  role: z.enum(['customer', 'admin']), // Corrected roles
  stripe_customer_id: z.string().optional().nullable(),
});
export type User = z.infer<typeof UserSchema>;

// Defines a service record, matching the database schema.
export const ServiceSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  service_date: z.string(), // ISO date string
  status: z.string(),
  notes: z.string().optional().nullable(),
  price_cents: z.number().optional().nullable(),
  stripe_invoice_id: z.string().optional().nullable(),
});
export type Service = z.infer<typeof ServiceSchema>;

// **MAJOR FIX**: Redefined the Job type to match what the frontend expects.
// This resolves the majority of the frontend errors.
export const JobSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  start: z.string(), // ISO date string
  end: z.string(),   // ISO date string
  status: z.string(),
  // Added optional fields seen in worker/src/calendar.ts
  recurrence: z.string().optional().nullable(),
  rrule: z.string().optional().nullable(),
  crewId: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Job = z.infer<typeof JobSchema>;

// Defines a photo, associated with a job or service.
export const PhotoSchema = z.object({
    id: z.string(),
    url: z.string().url(),
    created_at: z.string(), // ISO date string
});
export type Photo = z.infer<typeof PhotoSchema>;

// Defines a note.
export const NoteSchema = z.object({
    id: z.number(),
    content: z.string(),
    created_at: z.string(), // ISO date string
});
export type Note = z.infer<typeof NoteSchema>;


/* ========================================================================
   API, AUTH & NOTIFICATION TYPES
   ======================================================================== */

// FIX: Exporting AuthResponse for the API client.
export const AuthResponseSchema = z.object({
    token: z.string(),
    user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// FIX: Exporting PortalSession for the Stripe portal redirect.
export const PortalSessionSchema = z.object({
    url: z.string().url(),
});
export type PortalSession = z.infer<typeof PortalSessionSchema>;

// FIX: Exporting SMSMessage for the SMS components.
export const SMSMessageSchema = z.object({
    id: z.number().optional(),
    direction: z.enum(['incoming', 'outgoing']),
    message: z.string(),
    created_at: z.string(),
    status: z.enum(['pending', 'delivered', 'failed']).optional(),
    message_sid: z.string().optional().nullable(),
});
export type SMSMessage = z.infer<typeof SMSMessageSchema>;

// FIX: Exporting Conversation for the SMS conversations list.
export const ConversationSchema = z.object({
    phone_number: z.string(),
    last_message_at: z.string(),
    message_count: z.number(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// For notification worker queue
export const NotificationRequestSchema = z.object({
  type: z.string(),
  userId: z.union([z.string(), z.number()]),
  data: z.record(z.any()),
  channels: z.array(z.enum(['email', 'sms'])).optional()
});

export const EmailParamsSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  html: z.string(),
  text: z.string()
});

// For SMS sending results
export interface SendSMSResult {
  success: boolean;
  error?: string;
  messageSid?: string;
}

/* ========================================================================
   ENVIRONMENT & CLOUDFLARE TYPES
   ======================================================================== */

// FIX: Consolidating and exporting all worker environment variables and types.
export interface Env {
  // Bindings
  DB: D1Database;

  // Secrets
  JWT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  CF_IMAGES_ACCOUNT_HASH: string;
  CF_IMAGES_API_TOKEN: string;

  // Variables
  PORTAL_URL: string;
  ENVIRONMENT?: 'development' | 'production';

  // Notification Worker Specific (can be optional in other workers)
  EMAIL_FROM?: string;
  AWS_ACCESS_KEY_ID?: string;
  AWS_SECRET_ACCESS_KEY?: string;
  AWS_REGION?: string;
  SMS_FROM_NUMBER?: string;
  VOIPMS_USERNAME?: string;
  VOIPMS_PASSWORD?: string;
}

// BaseEnv alias for clarity in workers that extend it.
export type BaseEnv = Env;

// D1 Types for use in workers.
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
