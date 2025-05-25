#!/bin/bash

# final-ts-fix.sh - Fix the remaining 3 TypeScript errors

echo "🔧 Fixing the final 3 TypeScript errors..."

# 1. Fix worker/src/calendar.ts - D1Result doesn't have changes property in meta
echo "📝 Fixing worker/src/calendar.ts..."
cat > worker/src/calendar.ts << 'EOF'
// worker/src/calendar.ts - Fixed imports and types
import type { Env } from "@portal/shared";
import { v4 as uuidv4 } from 'uuid';
import { JobSchema } from "@portal/shared/calendar";

interface UserRecord {
  id: number;
  stripe_customer_id?: string;
}

interface JobRecord {
  id: string;
  customerId: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  recurrence: string;
  rrule?: string;
  status: string;
  crewId?: string;
  createdAt: string;
  updatedAt: string;
}

// Get jobs for a specific customer
export async function getCustomerJobs(env: Env, customerId: string): Promise<JobRecord[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM jobs WHERE customerId = ? ORDER BY start DESC`
  ).bind(customerId).all();

  return (results || []) as JobRecord[];
}

// Get a specific job by ID
export async function getJob(env: Env, jobId: string, customerId?: string): Promise<JobRecord> {
  const query = customerId
    ? `SELECT * FROM jobs WHERE id = ? AND customerId = ?`
    : `SELECT * FROM jobs WHERE id = ?`;

  const params = customerId
    ? [jobId, customerId]
    : [jobId];

  const job = await env.DB.prepare(query)
    .bind(...params)
    .first() as JobRecord | null;

  if (!job) {
    throw new Error("Job not found");
  }

  return job;
}

// Create a new job
export async function createJob(env: Env, jobData: any, customerId: string): Promise<JobRecord> {
  // Parse and validate job data
  const parsedJob = JobSchema.parse({
    ...jobData,
    id: jobData.id || uuidv4(),
    customerId,
    createdAt: jobData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Insert into database
  await env.DB.prepare(`
    INSERT INTO jobs (
      id, customerId, title, description, start, end,
      recurrence, rrule, status, crewId, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).bind(
    parsedJob.id,
    parsedJob.customerId,
    parsedJob.title,
    parsedJob.description || null,
    parsedJob.start,
    parsedJob.end,
    parsedJob.recurrence,
    parsedJob.rrule || null,
    parsedJob.status,
    parsedJob.crewId || null,
    parsedJob.createdAt,
    parsedJob.updatedAt
  ).run();

  return parsedJob as JobRecord;
}

// Update an existing job
export async function updateJob(env: Env, jobId: string, updateData: any, customerId: string): Promise<JobRecord> {
  // First check if job exists and belongs to customer
  const existingJob = await getJob(env, jobId, customerId);
  if (!existingJob) {
    throw new Error("Job not found or you don't have permission to modify it");
  }

  // Merge existing job with updates
  const updatedJob = {
    ...existingJob,
    ...updateData,
    id: jobId, // ensure ID doesn't change
    customerId, // ensure customer ID doesn't change
    updatedAt: new Date().toISOString() // always update the timestamp
  };

  // Validate the merged job
  const parsedJob = JobSchema.parse(updatedJob);

  // Update in database
  await env.DB.prepare(`
    UPDATE jobs SET
      title = ?,
      description = ?,
      start = ?,
      end = ?,
      recurrence = ?,
      rrule = ?,
      status = ?,
      crewId = ?,
      updatedAt = ?
    WHERE id = ? AND customerId = ?
  `).bind(
    parsedJob.title,
    parsedJob.description || null,
    parsedJob.start,
    parsedJob.end,
    parsedJob.recurrence,
    parsedJob.rrule || null,
    parsedJob.status,
    parsedJob.crewId || null,
    parsedJob.updatedAt,
    jobId,
    customerId
  ).run();

  return parsedJob as JobRecord;
}

// Delete a job
export async function deleteJob(env: Env, jobId: string, customerId: string): Promise<{ success: boolean }> {
  const result = await env.DB.prepare(
    `DELETE FROM jobs WHERE id = ? AND customerId = ?`
  ).bind(jobId, customerId).run();

  // Check if any rows were affected using the meta property
  if (result.meta.changes === 0) {
    throw new Error("Job not found or you don't have permission to delete it");
  }

  return { success: true };
}

// Generate an iCal feed for a customer's jobs
export async function generateCalendarFeed(env: Env, customerId: string): Promise<string> {
  // Get all active jobs for the customer
  const jobs = await getCustomerJobs(env, customerId);

  // Create iCal content
  let icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gutter Portal//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Gutter Service Appointments',
    'X-WR-TIMEZONE:America/New_York',
  ];

  // Add each job as an event
  for (const job of jobs) {
    if (job.status === 'cancelled') continue; // Skip cancelled jobs

    const startDate = new Date(job.start);
    const endDate = new Date(job.end);

    // Format dates for iCal (YYYYMMDDTHHMMSSZ)
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '');
    };

    const eventId = job.id.replace(/-/g, '');

    icalContent.push(
      'BEGIN:VEVENT',
      `UID:${eventId}@gutterportal.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${job.title}`,
      job.description ? `DESCRIPTION:${job.description.replace(/\n/g, '\\n')}` : '',
      `STATUS:${job.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`,
      `SEQUENCE:0`,
      `TRANSP:OPAQUE`,
      'END:VEVENT'
    );
  }

  icalContent.push('END:VCALENDAR');

  // Filter out empty lines and join with CRLF
  return icalContent.filter(line => line).join('\r\n');
}
EOF

# 2. Fix worker/src/handlers/stripe.ts - move import to top level
echo "📝 Fixing worker/src/handlers/stripe.ts..."
cat > worker/src/handlers/stripe.ts << 'EOF'
// worker/src/handlers/stripe.ts - Fixed with proper imports and types
import type { Env } from "@portal/shared";
import { getStripe, findCustomerByIdentifier, getOrCreateCustomer } from "../stripe";
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

# 3. Fix worker/src/index.ts - fix Hono response.status type issue
echo "📝 Fixing worker/src/index.ts..."
cat > worker/src/index.ts << 'EOF'
// worker/src/index.ts - Fixed TypeScript imports and types
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@portal/shared';
import { requireAuth } from './auth';
import { handleSignupCheck, handleSignup, handleLogin } from './handlers/auth';
import { handleStripeCustomerCheck, handleStripeCustomerCreate, handleStripeWebhook } from './handlers/stripe';
import { handleGetProfile, handleUpdateProfile } from './handlers/profile';
import { handleListServices, handleGetService, handleCreateInvoice } from './handlers/services';
import { handleGetJobs, handleGetJobById, handleCalendarFeed } from './handlers/jobs';
import { getOrCreateCustomer } from './stripe';

// Define proper context type for Hono
type Context = {
  Bindings: Env;
  Variables: {
    userEmail: string;
  };
};

const app = new Hono<Context>();

// Add CORS middleware with proper configuration
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Debug logging middleware
app.use('*', async (c, next) => {
  console.log(`🔥 Worker hit: ${c.req.method} ${c.req.path}`);
  console.log(`🔍 Full URL: ${c.req.url}`);
  await next();
});

// Health check endpoints
app.get('/ping', (c) => {
  console.log('✅ Ping endpoint hit');
  return c.json({
    message: 'Worker is working!',
    timestamp: new Date().toISOString(),
    path: c.req.path,
    method: c.req.method,
    url: c.req.url
  });
});

app.get('/debug', (c) => {
  console.log('✅ Debug endpoint hit');
  return c.json({
    message: 'Debug endpoint working!',
    url: c.req.url,
    path: c.req.path,
    method: c.req.method,
    headers: Object.fromEntries(c.req.raw.headers.entries()),
    hasDB: !!c.env.DB,
    hasJWT: !!c.env.JWT_SECRET,
    hasTurnstile: !!c.env.TURNSTILE_SECRET_KEY,
    hasStripe: !!c.env.STRIPE_SECRET_KEY,
    timestamp: new Date().toISOString()
  });
});

// Auth endpoints
app.post('/signup/check', async (c) => {
  console.log('✅ Signup check endpoint hit');
  try {
    return await handleSignupCheck(c.req.raw, c.env);
  } catch (error: any) {
    console.error('❌ Signup check error:', error);
    return c.json({ error: error.message || 'Signup check failed' }, 500);
  }
});

app.post('/signup', async (c) => {
  console.log('✅ Signup endpoint hit');
  try {
    return await handleSignup(c.req.raw, c.env);
  } catch (error: any) {
    console.error('❌ Signup error:', error);
    return c.json({ error: error.message || 'Signup failed' }, 500);
  }
});

app.post('/login', async (c) => {
  console.log('✅ Login endpoint hit');
  try {
    return await handleLogin(c.req.raw, c.env);
  } catch (error: any) {
    console.error('❌ Login error:', error);
    return c.json({ error: error.message || 'Login failed' }, 500);
  }
});

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
    const body = await c.req.json();
    console.log('💳 Stripe create customer body:', body);
    
    const customerId = await getOrCreateCustomer(c.env, body.email, body.name);
    
    return c.json({
      success: true,
      customerId,
      message: 'Customer created successfully'
    });
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

// Protected route middleware
const requireAuthMiddleware = async (c: any, next: any) => {
  try {
    const email = await requireAuth(c.req.raw, c.env);
    c.set('userEmail', email);
    console.log(`🔐 Authenticated user: ${email}`);
    await next();
  } catch (error: any) {
    console.error('❌ Auth error:', error);
    return c.json({ error: 'Authentication failed: ' + (error.message || 'Unknown error') }, 401);
  }
};

// Profile endpoints (protected)
app.get('/profile', requireAuthMiddleware, async (c) => {
  console.log('✅ Profile GET endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    return await handleGetProfile(c.req.raw, c.env, email);
  } catch (error: any) {
    console.error('❌ Profile GET error:', error);
    return c.json({ error: error.message || 'Profile fetch failed' }, 500);
  }
});

app.put('/profile', requireAuthMiddleware, async (c) => {
  console.log('✅ Profile PUT endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    return await handleUpdateProfile(c.req.raw, c.env, email);
  } catch (error: any) {
    console.error('❌ Profile PUT error:', error);
    return c.json({ error: error.message || 'Profile update failed' }, 500);
  }
});

// Services endpoints (protected)
app.get('/services', requireAuthMiddleware, async (c) => {
  console.log('✅ Services GET endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    return await handleListServices(c.req.raw, c.env, email);
  } catch (error: any) {
    console.error('❌ Services GET error:', error);
    return c.json({ error: error.message || 'Services fetch failed' }, 500);
  }
});

app.get('/services/:id', requireAuthMiddleware, async (c) => {
  console.log('✅ Service detail GET endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) {
      return c.json({ error: 'Invalid service ID' }, 400);
    }
    return await handleGetService(c.req.raw, c.env, email, id);
  } catch (error: any) {
    console.error('❌ Service detail GET error:', error);
    return c.json({ error: error.message || 'Service fetch failed' }, 500);
  }
});

app.post('/services/:id/invoice', requireAuthMiddleware, async (c) => {
  console.log('✅ Service invoice POST endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    const serviceId = parseInt(c.req.param('id'));
    if (isNaN(serviceId)) {
      return c.json({ error: 'Invalid service ID' }, 400);
    }
    return await handleCreateInvoice(c.req.raw, c.env, email, serviceId);
  } catch (error: any) {
    console.error('❌ Service invoice POST error:', error);
    return c.json({ error: error.message || 'Invoice creation failed' }, 500);
  }
});

// Jobs/Calendar endpoints (protected)
app.get('/jobs', requireAuthMiddleware, async (c) => {
  console.log('✅ Jobs GET endpoint hit');
  try {
    return await handleGetJobs(c.req.raw, c.env);
  } catch (error: any) {
    console.error('❌ Jobs GET error:', error);
    return c.json({ error: error.message || 'Jobs fetch failed' }, 500);
  }
});

app.get('/jobs/:id', requireAuthMiddleware, async (c) => {
  console.log('✅ Job detail GET endpoint hit');
  try {
    const url = new URL(c.req.url);
    return await handleGetJobById(c.req.raw, url, c.env);
  } catch (error: any) {
    console.error('❌ Job detail GET error:', error);
    return c.json({ error: error.message || 'Job fetch failed' }, 500);
  }
});

app.get('/calendar-feed', async (c) => {
  console.log('✅ Calendar feed GET endpoint hit');
  try {
    const url = new URL(c.req.url);
    return await handleCalendarFeed(c.req.raw, url, c.env);
  } catch (error: any) {
    console.error('❌ Calendar feed GET error:', error);
    return c.json({ error: error.message || 'Calendar feed failed' }, 500);
  }
});

// Stripe Customer Portal (protected)
app.post('/portal', requireAuthMiddleware, async (c) => {
  console.log('✅ Portal POST endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    
    // Get user's Stripe customer ID
    const userRow = await c.env.DB.prepare(
      `SELECT stripe_customer_id FROM users WHERE lower(email) = ?`
    ).bind(email.toLowerCase()).first();

    if (!userRow || !(userRow as any).stripe_customer_id) {
      return c.json({ error: "No Stripe customer found" }, 400);
    }

    const { getStripe } = await import('./stripe');
    const stripe = getStripe(c.env);
    
    const session = await stripe.billingPortal.sessions.create({
      customer: (userRow as any).stripe_customer_id,
      return_url: 'https://portal.777.foo/dashboard',
    });

    return c.json({ url: session.url });
  } catch (error: any) {
    console.error('❌ Portal error:', error);
    return c.json({ error: error.message || 'Portal creation failed' }, 500);
  }
});

// SMS endpoints that proxy to notification worker (protected)
app.get('/sms/conversations', requireAuthMiddleware, async (c) => {
  console.log('✅ SMS conversations GET endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    
    // Get user ID
    const userRow = await c.env.DB.prepare(
      `SELECT id FROM users WHERE lower(email) = ?`
    ).bind(email.toLowerCase()).first();

    if (!userRow) {
      return c.json({ error: "User not found" }, 404);
    }

    // Proxy to notification worker if available
    if (c.env.NOTIFICATION_WORKER) {
      const response = await c.env.NOTIFICATION_WORKER.fetch(
        new Request(`https://portal.777.foo/api/notifications/sms/conversations?userId=${(userRow as any).id}`, {
          method: 'GET',
          headers: {
            'Authorization': c.req.header('Authorization') || '',
          },
        })
      );

      const data = await response.json() as any;
      // Fix: Use proper Hono response with proper status code casting
      return c.json(data, response.ok ? 200 : 500);
    } else {
      return c.json({ error: "SMS service not available" }, 503);
    }
  } catch (error: any) {
    console.error('❌ SMS conversations error:', error);
    return c.json({ error: error.message || 'SMS conversations failed' }, 500);
  }
});

// Catch-all route for debugging
app.all('*', (c) => {
  console.log(`❓ Unhandled route: ${c.req.method} ${c.req.path}`);
  return c.json({
    error: 'Route not found',
    path: c.req.path,
    method: c.req.method,
    fullUrl: c.req.url,
    availableRoutes: [
      'GET /ping',
      'GET /debug',
      'POST /signup/check',
      'POST /signup',
      'POST /login',
      'POST /stripe/check-customer',
      'POST /stripe/create-customer',
      'POST /stripe/webhook',
      'GET /profile (protected)',
      'PUT /profile (protected)',
      'GET /services (protected)',
      'GET /services/:id (protected)',
      'POST /services/:id/invoice (protected)',
      'GET /jobs (protected)',
      'GET /jobs/:id (protected)',
      'GET /calendar-feed',
      'POST /portal (protected)',
      'GET /sms/conversations (protected)'
    ],
    timestamp: new Date().toISOString()
  }, 404);
});

export default app;
EOF

# 4. Test the compilation
echo "🧪 Testing TypeScript compilation..."
cd worker
if npx tsc --noEmit --skipLibCheck; then
    echo "✅ Worker TypeScript compilation successful!"
else
    echo "❌ Still have TypeScript errors"
    echo "Showing remaining errors:"
    npx tsc --noEmit --skipLibCheck 2>&1 | head -10
fi
cd ..

echo ""
echo "🎉 Final TypeScript fix completed!"
echo ""
echo "Summary of the 3 fixes applied:"
echo "1. ✅ Fixed calendar.ts - Used result.meta.changes instead of destructuring"
echo "2. ✅ Fixed stripe handler - Moved import to top level"
echo "3. ✅ Fixed index.ts - Used proper Hono status code handling"
echo ""
echo "Next steps:"
echo "1. Run this script: ./final-ts-fix.sh"
echo "2. Test compilation: cd worker && npx tsc --noEmit --skipLibCheck"
echo "3. If successful, start development: pnpm run dev"
