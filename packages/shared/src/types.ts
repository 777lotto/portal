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
export interface User {
  id: number | string;
  email: string;
  name: string;
  phone?: string;
  stripe_customer_id?: string;
  password_hash?: string;
  created_at?: string;
  updated_at?: string;
}

// Service types with Stripe integration
export interface Service {
  id: number;
  user_id: number;
  service_date: string;
  status: 'upcoming' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'invoiced' | 'paid';
  notes?: string;
  price_cents?: number;
  stripe_invoice_id?: string;
  created_at?: string;
  updated_at?: string;
}

// Stripe-specific types for better type safety
export interface StripeCustomerData {
  id: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  created: number;
  metadata?: Record<string, string>;
}

export interface StripeInvoiceData {
  id: string;
  customer: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  hosted_invoice_url?: string | null;
  created: number;
  due_date?: number | null;
}

// API request/response types
export interface StripeCustomerCheckRequest {
  email?: string;
  phone?: string;
}

export interface StripeCustomerCheckResponse {
  exists: boolean;
  customerId?: string;
  email?: string;
  name?: string;
  phone?: string;
}

export interface StripeCustomerCreateRequest {
  email: string;
  name: string;
  phone?: string;
}

export interface StripeCustomerCreateResponse {
  success: boolean;
  customerId: string;
  message: string;
}

// Invoice creation types
export interface InvoiceCreateRequest {
  amount_cents: number;
  description: string;
  due_days?: number;
}

export interface InvoiceCreateResponse {
  id: string;
  status: string;
  amount_due: number;
  hosted_invoice_url?: string;
  due_date: string;
  service_id: number;
}

// SMS types
export interface SMSMessage {
  id: number;
  user_id: number | string;
  direction: 'incoming' | 'outgoing';
  phone_number: string;
  message: string;
  message_sid?: string;
  status: 'pending' | 'delivered' | 'failed';
  created_at: string;
}

export interface SMSWebhookRequest {
  from: string;
  to: string;
  message: string;
  id?: string;
}

export interface SendSMSResult {
  success: boolean;
  error?: string;
  messageSid?: string;
}

// Notification types
export interface NotificationRequest {
  type: string;
  userId: number | string;
  data: Record<string, any>;
  channels?: string[];
}

export interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}

export interface NotificationRecord {
  id: number;
  user_id: number | string;
  type: string;
  channels: string;
  status: 'pending' | 'sent' | 'failed';
  metadata: string;
  created_at: string;
}

// API response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success?: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

// Authentication types
export interface AuthPayload {
  email: string;
  name?: string;
  phone?: string;
}

export interface LoginRequest {
  identifier: string; // email or phone
  password: string;
  turnstileToken?: string;
}

export interface SignupRequest {
  email?: string;
  phone?: string;
  name: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    email?: string;
    name: string;
    phone?: string;
  };
}

// Portal/Dashboard types
export interface PortalSession {
  url: string;
}

// Common database record interface
export interface DatabaseRecord {
  id: number;
  created_at?: string;
  updated_at?: string;
}

// conversation
export interface Conversation {
  phone_number: string;
  last_message_at: string;
  message_count: number;
}
