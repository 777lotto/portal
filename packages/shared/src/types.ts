// packages/shared/src/types.ts

// Environment variable types shared across workers
export interface Env {
  // D1 Database
  DB: D1Database;
  
  // Secrets
  JWT_SECRET: string;
  
  // Stripe
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  
  // Turnstile
  TURNSTILE_SECRET_KEY: string;
  
  // Worker bindings
  NOTIFICATION_WORKER: { fetch: (request: Request) => Promise<Response> };
  PAYMENT_WORKER: { fetch: (request: Request) => Promise<Response> };
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

// Additional shared types that might be needed
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
