#!/bin/bash

# comprehensive-fix.sh - Script to apply all TypeScript fixes

echo "🔧 Applying comprehensive TypeScript fixes..."

# 1. Replace the main worker files
echo "📝 Updating worker files..."

# Update worker/src/env.ts
cat > worker/src/env.ts << 'EOF'
// worker/src/env.ts - Use shared types instead of duplicating
export { 
  type Env, 
  type D1Database, 
  type D1PreparedStatement, 
  type D1Result, 
  type D1ExecResult 
} from '@portal/shared';
EOF

# Update worker/src/stripe.ts
cat > worker/src/stripe.ts << 'EOF'
// worker/src/stripe.ts - Fixed with correct Stripe API version and proper types
import Stripe from "stripe";
import type { Env } from "@portal/shared";

// Create a singleton Stripe instance
let stripeInstance: Stripe | null = null;

export function getStripe(env: Env): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-11-20.acacia", // Use a stable API version
    });
  }
  return stripeInstance;
}

export async function getOrCreateCustomer(
  env: Env,
  email: string,
  name: string
): Promise<string> {
  const stripe = getStripe(env);

  // Check if user already has a stripe_customer_id
  const result = await env.DB.prepare(
    `SELECT stripe_customer_id FROM users WHERE email = ?`
  ).bind(email).first();

  const existingRecord = result as { stripe_customer_id?: string } | null;
  if (existingRecord?.stripe_customer_id) {
    return existingRecord.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({ email, name });

  // Save to D1
  await env.DB.prepare(
    `UPDATE users SET stripe_customer_id = ? WHERE email = ?`
  ).bind(customer.id, email).run();

  return customer.id;
}

export async function createAndSendInvoice(
  env: Env,
  customerId: string,
  amount_cents: number,
  description: string
): Promise<Stripe.Invoice> {
  const stripe = getStripe(env);

  await stripe.invoiceItems.create({
    customer: customerId,
    amount: amount_cents,
    currency: "usd",
    description,
  });

  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: 0,
  });

  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
  return finalizedInvoice;
}
EOF

# 2. Update the shared types to include proper D1 return types
echo "📦 Updating shared types..."

cat > packages/shared/src/types.ts << 'EOF'
// packages/shared/src/types.ts - Complete shared types with proper exports

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
EOF

# 3. Rebuild shared package
echo "🔧 Rebuilding shared package..."
cd packages/shared
pnpm run build
cd ../..

# 4. Test worker compilation
echo "🧪 Testing worker compilation..."
cd worker
if npx tsc --noEmit --skipLibCheck; then
    echo "✅ Worker TypeScript compilation successful!"
else
    echo "❌ Worker still has TypeScript errors"
    echo "Showing detailed errors:"
    npx tsc --noEmit --skipLibCheck --pretty
fi
cd ..

# 5. Test notification worker compilation
echo "🧪 Testing notification worker compilation..."
cd notification
if npx tsc --noEmit --skipLibCheck; then
    echo "✅ Notification worker TypeScript compilation successful!"
else
    echo "❌ Notification worker still has TypeScript errors"
fi
cd ..

# 6. Test payment worker compilation
echo "🧪 Testing payment worker compilation..."
cd payment
if npx tsc --noEmit --skipLibCheck; then
    echo "✅ Payment worker TypeScript compilation successful!"
else
    echo "❌ Payment worker still has TypeScript errors"
fi
cd ..

# 7. Test frontend compilation
echo "🧪 Testing frontend compilation..."
cd frontend
if npx tsc --noEmit --skipLibCheck; then
    echo "✅ Frontend TypeScript compilation successful!"
else
    echo "❌ Frontend still has TypeScript errors"
fi
cd ..

echo ""
echo "🎉 Fix script completed!"
echo ""
echo "Next steps:"
echo "1. Run 'pnpm run typecheck' to verify all types are working"
echo "2. Run 'pnpm run build' to build all packages"
echo "3. Run 'pnpm run deploy' to deploy to Cloudflare"
EOF

chmod +x comprehensive-fix.sh

echo "✅ Comprehensive fix script created!"
echo ""
echo "To apply all fixes, run:"
echo "  ./comprehensive-fix.sh"
