// worker/src/env.ts - Environment types for the worker
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
  
  // Service bindings
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
