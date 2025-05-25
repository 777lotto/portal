// packages/shared/src/types.ts - Complete shared types

// Base environment interface - this is the minimal shared structure
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

// D1 database types
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T>;
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

// User-related types
export interface User {
  id: number | string;
  email: string;
  name: string;
  phone?: string;
  stripe_customer_id?: string;
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

// Service types
export interface Service {
  id: number;
  user_id: number;
  service_date: string;
  status: string;
  notes?: string;
  price_cents?: number;
  stripe_invoice_id?: string;
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
}
