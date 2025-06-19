// packages/shared/src/types.ts

import { z } from 'zod';

// Base environment interface - this is the minimal shared structure that all workers extend
export interface BaseEnv {
  // D1 Database
  DB: D1Database;

  // Secrets
  JWT_SECRET: string;

  // Stripe (optional - not all workers use Stripe)
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;

  // Turnstile (optional)
  TURNSTILE_SECRET_KEY?: string;
}

// Main worker environment (extends base with service bindings)
export interface Env extends BaseEnv {
  // Stripe is required for main worker
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;

  // Turnstile is required for main worker
  TURNSTILE_SECRET_KEY: string;

  // Service bindings (optional - not all workers have all bindings)
  NOTIFICATION_WORKER?: { fetch: (request: Request) => Promise<Response> };
  PAYMENT_WORKER?: { fetch: (request: Request) => Promise<Response> };

  // Environment variables
  ENVIRONMENT?: string;
  API_VERSION?: string;
}

// D1 database types - properly exported
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta: {
    changed_db: boolean;
    changes: number;
    duration: number;
    last_row_id: number;
    served_by: string;
    rows_read: number;
    rows_written: number;
  };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

// User-related types with proper Stripe integration
export const UserSchema = z.object({
  id: z.union([z.number(), z.string()]),
  email: z.string().email(),
  name: z.string(),
  phone: z.string().optional(),
  stripe_customer_id: z.string().optional(),
  password_hash: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type User = z.infer<typeof UserSchema>;

// Service types with Stripe integration
export const ServiceSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  service_date: z.string(),
  status: z.enum(['upcoming', 'confirmed', 'in_progress', 'completed', 'cancelled', 'invoiced', 'paid']),
  notes: z.string().optional(),
  price_cents: z.number().optional(),
  stripe_invoice_id: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type Service = z.infer<typeof ServiceSchema>;

// Stripe-specific types for better type safety
export const StripeCustomerDataSchema = z.object({
  id: z.string(),
  email: z.string().email().nullable().optional(),
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  created: z.number(),
  metadata: z.record(z.string()).optional(),
});
export type StripeCustomerData = z.infer<typeof StripeCustomerDataSchema>;

export const StripeInvoiceDataSchema = z.object({
    id: z.string(),
    customer: z.string(),
    amount_due: z.number(),
    amount_paid: z.number(),
    currency: z.string(),
    status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']),
    hosted_invoice_url: z.string().nullable().optional(),
    created: z.number(),
    due_date: z.number().nullable().optional(),
});
export type StripeInvoiceData = z.infer<typeof StripeInvoiceDataSchema>;


// API request/response types
export const StripeCustomerCheckRequestSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
});
export type StripeCustomerCheckRequest = z.infer<typeof StripeCustomerCheckRequestSchema>;

export const StripeCustomerCheckResponseSchema = z.object({
  exists: z.boolean(),
  customerId: z.string().optional(),
  email: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
});
export type StripeCustomerCheckResponse = z.infer<typeof StripeCustomerCheckResponseSchema>;

export const StripeCustomerCreateRequestSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  phone: z.string().optional(),
});
export type StripeCustomerCreateRequest = z.infer<typeof StripeCustomerCreateRequestSchema>;

export const StripeCustomerCreateResponseSchema = z.object({
    success: z.boolean(),
    customerId: z.string(),
    message: z.string(),
});
export type StripeCustomerCreateResponse = z.infer<typeof StripeCustomerCreateResponseSchema>;

// Invoice creation types
export const InvoiceCreateRequestSchema = z.object({
  amount_cents: z.number(),
  description: z.string(),
  due_days: z.number().optional(),
});
export type InvoiceCreateRequest = z.infer<typeof InvoiceCreateRequestSchema>;

export const InvoiceCreateResponseSchema = z.object({
    id: z.string(),
    status: z.string(),
    amount_due: z.number(),
    hosted_invoice_url: z.string().optional(),
    due_date: z.string(),
    service_id: z.number(),
});
export type InvoiceCreateResponse = z.infer<typeof InvoiceCreateResponseSchema>;

// SMS types
export const SMSMessageSchema = z.object({
    id: z.number(),
    user_id: z.union([z.number(), z.string()]),
    direction: z.enum(['incoming', 'outgoing']),
    phone_number: z.string(),
    message: z.string(),
    message_sid: z.string().optional(),
    status: z.enum(['pending', 'delivered', 'failed']),
    created_at: z.string(),
});
export type SMSMessage = z.infer<typeof SMSMessageSchema>;

export const SMSWebhookRequestSchema = z.object({
  from: z.string(),
  to: z.string(),
  message: z.string(),
  id: z.string().optional(),
});
export type SMSWebhookRequest = z.infer<typeof SMSWebhookRequestSchema>;

export const SendSMSResultSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  messageSid: z.string().optional(),
});
export type SendSMSResult = z.infer<typeof SendSMSResultSchema>;


// Notification types
export const NotificationRequestSchema = z.object({
  type: z.string(),
  userId: z.union([z.number(), z.string()]),
  data: z.record(z.any()),
  channels: z.array(z.string()).optional(),
});
export type NotificationRequest = z.infer<typeof NotificationRequestSchema>;

export const EmailParamsSchema = z.object({
  to: z.string().email(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
  from: z.string().email().optional(),
  replyTo: z.string().email().optional(),
});
export type EmailParams = z.infer<typeof EmailParamsSchema>;

export const NotificationRecordSchema = z.object({
    id: z.number(),
    user_id: z.union([z.number(), z.string()]),
    type: z.string(),
    channels: z.string(),
    status: z.enum(['pending', 'sent', 'failed']),
    metadata: z.string(),
    created_at: z.string(),
});
export type NotificationRecord = z.infer<typeof NotificationRecordSchema>;

// API response types
export const ApiResponseSchema = z.object({
    data: z.any().optional(),
    error: z.string().optional(),
    success: z.boolean().optional(),
});
export type ApiResponse<T = any> = z.infer<typeof ApiResponseSchema> & { data?: T };

export const ApiErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  status: z.number().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;


// Authentication types
export const AuthPayloadSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  phone: z.string().optional(),
});
export type AuthPayload = z.infer<typeof AuthPayloadSchema>;

export const LoginRequestSchema = z.object({
  identifier: z.string(), // email or phone
  password: z.string(),
  turnstileToken: z.string().optional(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const SignupRequestSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  name: z.string(),
  password: z.string(),
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const AuthResponseSchema = z.object({
    token: z.string(),
    user: z.object({
        id: z.number(),
        email: z.string().email().optional(),
        name: z.string(),
        phone: z.string().optional(),
    }),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// Portal/Dashboard types
export const PortalSessionSchema = z.object({
    url: z.string(),
});
export type PortalSession = z.infer<typeof PortalSessionSchema>;

// Common database record interface
export const DatabaseRecordSchema = z.object({
    id: z.number(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
});
export type DatabaseRecord = z.infer<typeof DatabaseRecordSchema>;

// conversation
export const ConversationSchema = z.object({
    phone_number: z.string(),
    last_message_at: z.string(),
    message_count: z.number(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// Schema for the payment reminder request
export const SendReminderSchema = z.object({
  serviceId: z.number().positive('Service ID must be a positive number'),
});
export type SendReminderRequest = z.infer<typeof SendReminderSchema>;
