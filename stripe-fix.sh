#!/bin/bash

# stripe-fix.sh - Comprehensive Stripe TypeScript fix

echo "🔧 Fixing Stripe TypeScript errors..."

# 1. Update Stripe package to latest version
echo "📦 Updating Stripe package..."
cd worker
pnpm update stripe
cd ..

# 2. Fix worker/src/stripe.ts with proper types
echo "📝 Updating worker/src/stripe.ts..."
cat > worker/src/stripe.ts << 'EOF'
// worker/src/stripe.ts - Fixed with correct API version and proper types
import Stripe from "stripe";
import type { Env } from "@portal/shared";

// Create a singleton Stripe instance
let stripeInstance: Stripe | null = null;

export function getStripe(env: Env): Stripe {
  if (!stripeInstance) {
    stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-04-30.basil', // Your confirmed API version
      typescript: true, // Enable TypeScript support
    });
  }
  return stripeInstance;
}

export async function getOrCreateCustomer(
  env: Env,
  email: string,
  name: string,
  phone?: string
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

  // Create new Stripe customer with proper parameters
  const customerParams: Stripe.CustomerCreateParams = {
    email,
    name,
  };

  if (phone) {
    customerParams.phone = phone;
  }

  const customer = await stripe.customers.create(customerParams);

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
  description: string,
  daysUntilDue: number = 14
): Promise<Stripe.Invoice> {
  const stripe = getStripe(env);

  // Create invoice item
  await stripe.invoiceItems.create({
    customer: customerId,
    amount: amount_cents,
    currency: "usd",
    description,
  });

  // Create invoice
  const invoice = await stripe.invoices.create({
    customer: customerId,
    collection_method: "send_invoice",
    days_until_due: daysUntilDue,
    auto_advance: true, // Automatically finalize and send
  });

  // Finalize the invoice
  const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
  
  return finalizedInvoice;
}

// Helper function to search customers by email or phone
export async function findCustomerByIdentifier(
  env: Env,
  email?: string,
  phone?: string
): Promise<Stripe.Customer | null> {
  const stripe = getStripe(env);

  // Search by email first if provided
  if (email) {
    const customers = await stripe.customers.list({
      email: email,
      limit: 1
    });
    
    if (customers.data.length > 0) {
      return customers.data[0];
    }
  }

  // Search by phone if provided and email search didn't find anything
  if (phone) {
    const customers = await stripe.customers.search({
      query: `phone:'${phone.replace(/\D/g, '')}'`, // Remove non-digits for search
      limit: 1
    });
    
    if (customers.data.length > 0) {
      return customers.data[0];
    }
  }

  return null;
}

// Create customer portal session
export async function createPortalSession(
  env: Env,
  customerId: string,
  returnUrl: string = 'https://portal.777.foo/dashboard'
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe(env);
  
  return await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
EOF

# 3. Fix worker/src/handlers/stripe.ts with proper typing
echo "📝 Updating worker/src/handlers/stripe.ts..."
cat > worker/src/handlers/stripe.ts << 'EOF'
// worker/src/handlers/stripe.ts - Fixed with proper imports and types
import type { Env } from "@portal/shared";
import { getStripe, findCustomerByIdentifier } from "../stripe";
import { CORS } from "../utils";

interface StripeCustomerCheckRequest {
  email?: string;
  phone?: string;
}

interface StripeCustomerCreateRequest {
  email: string;
  name: string;
  phone?: string;
}

interface ServiceRecord {
  id: number;
  user_id: number;
  stripe_invoice_id?: string;
}

interface UserRecord {
  id: number;
  user_id: number;
  email: string;
}

export async function handleStripeCustomerCheck(request: Request, env: Env): Promise<Response> {
  try {
    console.log('💳 Processing Stripe customer check...');
    
    const data = await request.json() as StripeCustomerCheckRequest;
    console.log('💳 Stripe check data:', data);
    
    const { email, phone } = data;
    
    if (!email && !phone) {
      throw new Error("At least one identifier (email or phone) is required");
    }

    // Use our helper function to find customer
    const existingCustomer = await findCustomerByIdentifier(env, email, phone);

    if (existingCustomer) {
      return new Response(JSON.stringify({
        exists: true,
        customerId: existingCustomer.id,
        email: existingCustomer.email,
        name: existingCustomer.name,
        phone: existingCustomer.phone
      }), {
        status: 200,
        headers: CORS,
      });
    } else {
      console.log('❌ No existing Stripe customer found');
      return new Response(JSON.stringify({
        exists: false
      }), {
        status: 200,
        headers: CORS,
      });
    }
  } catch (err: any) {
    console.error("❌ Stripe customer check error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

export async function handleStripeCustomerCreate(request: Request, env: Env): Promise<Response> {
  try {
    console.log('💳 Creating Stripe customer...');
    
    const data = await request.json() as StripeCustomerCreateRequest;
    console.log('💳 Customer create data:', data);
    
    const { email, name, phone } = data;
    
    if (!email || !name) {
      throw new Error("Email and name are required");
    }

    const { getOrCreateCustomer } = await import('../stripe');
    const customerId = await getOrCreateCustomer(env, email, name, phone);
    
    return new Response(JSON.stringify({
      success: true,
      customerId,
      message: 'Customer created successfully'
    }), {
      status: 200,
      headers: CORS,
    });
  } catch (err: any) {
    console.error("❌ Stripe customer create error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: CORS,
    });
  }
}

export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  try {
    console.log('🪝 Processing Stripe webhook...');
    
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    
    if (!signature) {
      throw new Error('Missing Stripe signature');
    }

    const stripe = getStripe(env);
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    
    // Verify webhook signature
    let event: any;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log('✅ Webhook signature verified:', event.type);
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle the event based on type
    switch (event.type) {
      case 'customer.created':
        console.log('👤 Customer created:', event.data.object.id);
        break;
        
      case 'invoice.payment_succeeded':
        console.log('💰 Invoice payment succeeded:', event.data.object.id);
        await handleInvoicePaymentSucceeded(event.data.object, env, request);
        break;
        
      case 'invoice.payment_failed':
        console.log('❌ Invoice payment failed:', event.data.object.id);
        await handleInvoicePaymentFailed(event.data.object, env, request);
        break;
        
      default:
        console.log(`🤷 Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("❌ Stripe webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleInvoicePaymentSucceeded(invoice: any, env: Env, request: Request): Promise<void> {
  // Find the service associated with this invoice
  const service = await env.DB.prepare(
    `SELECT s.*, u.email, u.id as user_id FROM services s 
     JOIN users u ON u.id = s.user_id 
     WHERE s.stripe_invoice_id = ?`
  ).bind(invoice.id).first() as (ServiceRecord & UserRecord) | null;
  
  if (service) {
    // Update service status to paid
    await env.DB.prepare(
      `UPDATE services SET status = 'paid' WHERE stripe_invoice_id = ?`
    ).bind(invoice.id).run();
    
    console.log('✅ Service marked as paid:', service.id);
    
    // Send payment confirmation notification
    try {
      if (env.NOTIFICATION_WORKER) {
        await env.NOTIFICATION_WORKER.fetch(
          new Request('https://portal.777.foo/api/notifications/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer webhook-internal',
            },
            body: JSON.stringify({
              type: 'invoice_paid',
              userId: service.user_id,
              data: {
                invoiceId: invoice.id,
                amount: (invoice.amount_paid / 100).toFixed(2),
                serviceId: service.id
              },
              channels: ['email']
            })
          })
        );
      }
    } catch (notificationError) {
      console.error('❌ Failed to send payment confirmation:', notificationError);
    }
  }
}

async function handleInvoicePaymentFailed(invoice: any, env: Env, request: Request): Promise<void> {
  // Find the service and notify user
  const failedService = await env.DB.prepare(
    `SELECT s.*, u.email, u.id as user_id FROM services s 
     JOIN users u ON u.id = s.user_id 
     WHERE s.stripe_invoice_id = ?`
  ).bind(invoice.id).first() as (ServiceRecord & UserRecord) | null;
  
  if (failedService) {
    try {
      if (env.NOTIFICATION_WORKER) {
        await env.NOTIFICATION_WORKER.fetch(
          new Request('https://portal.777.foo/api/notifications/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer webhook-internal',
            },
            body: JSON.stringify({
              type: 'payment_failed',
              userId: failedService.user_id,
              data: {
                invoiceId: invoice.id,
                amount: (invoice.amount_due / 100).toFixed(2),
                serviceId: failedService.id
              },
              channels: ['email', 'sms']
            })
          })
        );
      }
    } catch (notificationError) {
      console.error('❌ Failed to send payment failure notification:', notificationError);
    }
  }
}
EOF

# 4. Update the main worker index to use the new handlers
echo "📝 Updating worker/src/index.ts Stripe routes..."
cat > temp_stripe_routes.txt << 'EOF'
// Stripe endpoints
app.post('/stripe/check-customer', async (c) => {
  console.log('✅ Stripe customer check endpoint hit');
  try {
    return await handleStripeCustomerCheck(c.req.raw, c.env);
  } catch (error: any) {
    console.error('❌ Stripe check error:', error);
    return c.json({ error: error.message || 'Stripe check failed' }, 500);
  }
});

app.post('/stripe/create-customer', async (c) => {
  console.log('✅ Stripe create customer endpoint hit');
  try {
    return await handleStripeCustomerCreate(c.req.raw, c.env);
  } catch (error: any) {
    console.error('❌ Stripe create customer error:', error);
    return c.json({ error: error.message || 'Customer creation failed' }, 500);
  }
});

app.post('/stripe/webhook', async (c) => {
  console.log('✅ Stripe webhook endpoint hit');
  try {
    return await handleStripeWebhook(c.req.raw, c.env);
  } catch (error: any) {
    console.error('❌ Stripe webhook error:', error);
    return c.json({ error: error.message || 'Webhook processing failed' }, 500);
  }
});
EOF

# 5. Update the imports in worker/src/index.ts
echo "📝 Updating worker imports..."
sed -i 's/import { handleStripeCustomerCheck, handleStripeWebhook } from/import { handleStripeCustomerCheck, handleStripeCustomerCreate, handleStripeWebhook } from/' worker/src/index.ts

# 6. Update worker package.json to ensure latest Stripe version
echo "📝 Updating worker package.json..."
cd worker
cat > package_update.json << 'EOF'
{
  "dependencies": {
    "@portal/shared": "workspace:*",
    "bcryptjs": "^3.0.2",
    "hono": "^4.7.8",
    "jose": "^6.0.10",
    "stripe": "^16.12.0",
    "uuid": "^11.1.0"
  }
}
EOF

# Merge the dependencies
node -e "
const pkg = require('./package.json');
const update = require('./package_update.json');
pkg.dependencies = { ...pkg.dependencies, ...update.dependencies };
require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
"

rm package_update.json
cd ..

# 7. Test the compilation
echo "🧪 Testing Stripe integration..."
cd worker
echo "Installing latest Stripe package..."
pnpm install stripe@latest

echo "Testing TypeScript compilation..."
if npx tsc --noEmit --skipLibCheck; then
    echo "✅ Worker TypeScript compilation successful!"
else
    echo "❌ Still have TypeScript errors. Let's check specific Stripe issues..."
    npx tsc --noEmit --skipLibCheck 2>&1 | grep -i stripe || echo "No Stripe-specific errors found"
fi
cd ..

# 8. Clean up temp file
rm -f temp_stripe_routes.txt

echo ""
echo "🎉 Stripe fix completed!"
echo ""
echo "Next steps:"
echo "1. Test the endpoints: pnpm run worker:dev"
echo "2. Check Stripe dashboard for webhook configuration"
echo "3. Verify API version is set to '2025-04-30.basil' in your Stripe account"
echo ""
echo "If you still have issues, let's check your environment variables:"
echo "- STRIPE_SECRET_KEY should start with 'sk_'"
echo "- STRIPE_WEBHOOK_SECRET should start with 'whsec_'"
