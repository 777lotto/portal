// worker/src/index.ts - Fixed SMS conversations endpoint
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

// Enhanced CORS middleware - allow all origins for debugging
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false,
}));

// Enhanced debug logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const fullUrl = c.req.url;
  const origin = c.req.header('origin');
  
  console.log(`🔥 [MAIN-WORKER] ${method} ${path}`);
  console.log(`🌐 Origin: ${origin || 'none'}`);
  console.log(`🔍 Full URL: ${fullUrl}`);
  
  await next();
  
  const duration = Date.now() - start;
  console.log(`⏱️  [MAIN-WORKER] Request completed in ${duration}ms`);
});

// CORS preflight handler for all routes
app.options('*', (c) => {  
  console.log(`✅ CORS preflight for ${c.req.path}`);
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    }
  });
});

// Root endpoint for testing (handles both / and /api/)
app.get('/', (c) => {
  console.log('✅ Root endpoint hit');
  return c.json({
    message: 'Main API Worker is working!',
    timestamp: new Date().toISOString(),
    path: c.req.path,
    method: c.req.method,
    worker: 'main-api'
  });
});

app.get('/api', (c) => {
  console.log('✅ API root endpoint hit');
  return c.json({
    message: 'Main API Worker is working!',
    timestamp: new Date().toISOString(),
    path: c.req.path,
    method: c.req.method,
    worker: 'main-api'
  });
});

// Health check endpoints (both with and without /api prefix)
app.get('/ping', (c) => {
  console.log('✅ Ping endpoint hit');
  return c.json({
    message: 'Main API Worker is working!',
    timestamp: new Date().toISOString(),
    path: c.req.path,
    method: c.req.method,
    url: c.req.url,
    worker: 'main-api'
  });
});

app.get('/api/ping', (c) => {
  console.log('✅ API Ping endpoint hit');
  return c.json({
    message: 'Main API Worker is working!',
    timestamp: new Date().toISOString(),
    path: c.req.path,
    method: c.req.method,
    url: c.req.url,
    worker: 'main-api'
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
    timestamp: new Date().toISOString(),
    worker: 'main-api',
    environment: c.env.ENVIRONMENT || 'development'
  });
});

app.get('/api/debug', (c) => {
  console.log('✅ API Debug endpoint hit');
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
    timestamp: new Date().toISOString(),
    worker: 'main-api',
    environment: c.env.ENVIRONMENT || 'development'
  });
});

// Auth endpoints (with /api prefix)
app.post('/api/signup/check', async (c) => {
  console.log('✅ [MAIN-WORKER] Signup check endpoint hit');
  try {
    return await handleSignupCheck(c.req.raw, c.env);
  } catch (error: any) {
    console.error('❌ Signup check error:', error);
    return c.json({ 
      error: error.message || 'Signup check failed'
    }, 500);
  }
});

app.post('/api/signup', async (c) => {
  console.log('✅ [MAIN-WORKER] Signup endpoint hit');
  try {
    return await handleSignup(c.req.raw, c.env);
  } catch (error: any) {
    console.error('❌ Signup error:', error);
    return c.json({ 
      error: error.message || 'Signup failed'
    }, 500);
  }
});

app.post('/api/login', async (c) => {
  console.log('✅ [MAIN-WORKER] Login endpoint hit');
  try {
    return await handleLogin(c.req.raw, c.env);
  } catch (error: any) {
    console.error('❌ Login error:', error);
    return c.json({ 
      error: error.message || 'Login failed'
    }, 500);
  }
});

// Stripe endpoints (with /api prefix)
app.post('/api/stripe/check-customer', async (c) => {
  console.log('✅ [MAIN-WORKER] Stripe customer check endpoint hit');
  try {
    return await handleStripeCustomerCheck(c.req.raw, c.env);
  } catch (error: any) {
    console.error('❌ Stripe check error:', error);
    return c.json({ error: error.message || 'Stripe check failed' }, 500);
  }
});

app.post('/api/stripe/create-customer', async (c) => {
  console.log('✅ [MAIN-WORKER] Stripe create customer endpoint hit');
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

app.post('/api/stripe/webhook', async (c) => {
  console.log('✅ [MAIN-WORKER] Stripe webhook endpoint hit');
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
    console.log(`🔐 [MAIN-WORKER] Authenticated user: ${email}`);
    await next();
  } catch (error: any) {
    console.error('❌ Auth error:', error);
    return c.json({ error: 'Authentication failed: ' + (error.message || 'Unknown error') }, 401);
  }
};

// Profile endpoints (protected, with /api prefix)
app.get('/api/profile', requireAuthMiddleware, async (c) => {
  console.log('✅ [MAIN-WORKER] Profile GET endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    return await handleGetProfile(c.req.raw, c.env, email);
  } catch (error: any) {
    console.error('❌ Profile GET error:', error);
    return c.json({ error: error.message || 'Profile fetch failed' }, 500);
  }
});

app.put('/api/profile', requireAuthMiddleware, async (c) => {
  console.log('✅ [MAIN-WORKER] Profile PUT endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    return await handleUpdateProfile(c.req.raw, c.env, email);
  } catch (error: any) {
    console.error('❌ Profile PUT error:', error);
    return c.json({ error: error.message || 'Profile update failed' }, 500);
  }
});

// Services endpoints (protected, with /api prefix)
app.get('/api/services', requireAuthMiddleware, async (c) => {
  console.log('✅ [MAIN-WORKER] Services GET endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    return await handleListServices(c.req.raw, c.env, email);
  } catch (error: any) {
    console.error('❌ Services GET error:', error);
    return c.json({ error: error.message || 'Services fetch failed' }, 500);
  }
});

app.get('/api/services/:id', requireAuthMiddleware, async (c) => {
  console.log('✅ [MAIN-WORKER] Service detail GET endpoint hit');
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

app.post('/api/services/:id/invoice', requireAuthMiddleware, async (c) => {
  console.log('✅ [MAIN-WORKER] Service invoice POST endpoint hit');
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

// Jobs/Calendar endpoints (protected, with /api prefix)
app.get('/api/jobs', requireAuthMiddleware, async (c) => {
  console.log('✅ [MAIN-WORKER] Jobs GET endpoint hit');
  try {
    return await handleGetJobs(c.req.raw, c.env);
  } catch (error: any) {
    console.error('❌ Jobs GET error:', error);
    return c.json({ error: error.message || 'Jobs fetch failed' }, 500);
  }
});

app.get('/api/jobs/:id', requireAuthMiddleware, async (c) => {
  console.log('✅ [MAIN-WORKER] Job detail GET endpoint hit');
  try {
    const url = new URL(c.req.url);
    return await handleGetJobById(c.req.raw, url, c.env);
  } catch (error: any) {
    console.error('❌ Job detail GET error:', error);
    return c.json({ error: error.message || 'Job fetch failed' }, 500);
  }
});

app.get('/api/calendar-feed', async (c) => {
  console.log('✅ [MAIN-WORKER] Calendar feed GET endpoint hit');
  try {
    const url = new URL(c.req.url);
    return await handleCalendarFeed(c.req.raw, url, c.env);
  } catch (error: any) {
    console.error('❌ Calendar feed GET error:', error);
    return c.json({ error: error.message || 'Calendar feed failed' }, 500);
  }
});

// Stripe Customer Portal (protected, with /api prefix)
app.post('/api/portal', requireAuthMiddleware, async (c) => {
  console.log('✅ [MAIN-WORKER] Portal POST endpoint hit');
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

// SMS endpoints that proxy to notification worker (protected, with /api prefix)
app.get('/api/sms/conversations', requireAuthMiddleware, async (c) => {
  console.log('✅ [MAIN-WORKER] SMS conversations GET endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    
    // Get user ID
    const userRow = await c.env.DB.prepare(
      `SELECT id FROM users WHERE lower(email) = ?`
    ).bind(email.toLowerCase()).first();

    if (!userRow) {
      return c.json({ error: "User not found" }, 404);
    }

    const userId = (userRow as any).id;
    console.log(`📱 Getting SMS conversations for user ID: ${userId}`);

    // Proxy to notification worker if available
    if (c.env.NOTIFICATION_WORKER) {
      const response = await c.env.NOTIFICATION_WORKER.fetch(
        new Request(`https://portal.777.foo/api/notifications/sms/conversations?userId=${userId}`, {
          method: 'GET',
          headers: {
            'Authorization': c.req.header('Authorization') || '',
          },
        })
      );

      if (response.ok) {
        const data = await response.json() as any;
        console.log(`✅ SMS conversations retrieved:`, data);
        return c.json(data);
      } else {
        const errorText = await response.text();
        console.error('❌ Notification worker error:', errorText);
        return c.json({ error: "SMS service error: " + errorText }, response.status);
      }
    } else {
      console.error('❌ NOTIFICATION_WORKER not available');
      return c.json({ error: "SMS service not available" }, 503);
    }
  } catch (error: any) {
    console.error('❌ SMS conversations error:', error);
    return c.json({ error: error.message || 'SMS conversations failed' }, 500);
  }
});

// SMS messages for specific conversation (protected, with /api prefix)
app.get('/api/sms/messages/:phoneNumber', requireAuthMiddleware, async (c) => {
  console.log('✅ [MAIN-WORKER] SMS messages GET endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    const phoneNumber = c.req.param('phoneNumber');
    
    // Get user ID
    const userRow = await c.env.DB.prepare(
      `SELECT id FROM users WHERE lower(email) = ?`
    ).bind(email.toLowerCase()).first();

    if (!userRow) {
      return c.json({ error: "User not found" }, 404);
    }

    const userId = (userRow as any).id;
    console.log(`📱 Getting SMS messages for user ID: ${userId}, phone: ${phoneNumber}`);

    // Proxy to notification worker if available
    if (c.env.NOTIFICATION_WORKER) {
      const response = await c.env.NOTIFICATION_WORKER.fetch(
        new Request(`https://portal.777.foo/api/notifications/sms/messages/${phoneNumber}?userId=${userId}`, {
          method: 'GET',
          headers: {
            'Authorization': c.req.header('Authorization') || '',
          },
        })
      );

      if (response.ok) {
        const data = await response.json() as any;
        console.log(`✅ SMS messages retrieved for ${phoneNumber}`);
        return c.json(data);
      } else {
        const errorText = await response.text();
        console.error('❌ Notification worker error:', errorText);
        return c.json({ error: "SMS service error: " + errorText }, response.status);
      }
    } else {
      console.error('❌ NOTIFICATION_WORKER not available');
      return c.json({ error: "SMS service not available" }, 503);
    }
  } catch (error: any) {
    console.error('❌ SMS messages error:', error);
    return c.json({ error: error.message || 'SMS messages failed' }, 500);
  }
});

// Send SMS endpoint (protected, with /api prefix)
app.post('/api/sms/send', requireAuthMiddleware, async (c) => {
  console.log('✅ [MAIN-WORKER] SMS send POST endpoint hit');
  try {
    const email = c.get('userEmail') as string;
    const body = await c.req.json();
    
    // Get user ID
    const userRow = await c.env.DB.prepare(
      `SELECT id FROM users WHERE lower(email) = ?`
    ).bind(email.toLowerCase()).first();

    if (!userRow) {
      return c.json({ error: "User not found" }, 404);
    }

    const userId = (userRow as any).id;
    console.log(`📱 Sending SMS for user ID: ${userId}, to: ${body.to}`);

    // Proxy to notification worker if available
    if (c.env.NOTIFICATION_WORKER) {
      const response = await c.env.NOTIFICATION_WORKER.fetch(
        new Request(`https://portal.777.foo/api/notifications/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': c.req.header('Authorization') || '',
          },
          body: JSON.stringify({
            type: 'direct_sms',
            userId: userId,
            data: {
              to: body.to,
              message: body.message
            },
            channels: ['sms']
          })
        })
      );

      if (response.ok) {
        const data = await response.json() as any;
        console.log(`✅ SMS sent successfully`);
        return c.json(data);
      } else {
        const errorText = await response.text();
        console.error('❌ SMS send error:', errorText);
        return c.json({ error: "SMS send failed: " + errorText }, response.status);
      }
    } else {
      console.error('❌ NOTIFICATION_WORKER not available');
      return c.json({ error: "SMS service not available" }, 503);
    }
  } catch (error: any) {
    console.error('❌ SMS send error:', error);
    return c.json({ error: error.message || 'SMS send failed' }, 500);
  }
});

// Catch-all route for debugging
app.all('*', (c) => {
  console.log(`❓ [MAIN-WORKER] Unhandled route: ${c.req.method} ${c.req.path}`);
  console.log(`🔍 Headers:`, Object.fromEntries(c.req.raw.headers.entries()));
  
  return c.json({
    error: 'Route not found',
    path: c.req.path,
    method: c.req.method,
    fullUrl: c.req.url,
    worker: 'main-api',
    availableRoutes: [
      'GET /',
      'GET /api',
      'GET /ping',
      'GET /api/ping',
      'GET /debug',
      'GET /api/debug',
      'POST /api/signup/check',
      'POST /api/signup',
      'POST /api/login',
      'POST /api/stripe/check-customer',
      'POST /api/stripe/create-customer',
      'POST /api/stripe/webhook',
      'GET /api/profile (protected)',
      'PUT /api/profile (protected)',
      'GET /api/services (protected)',
      'GET /api/services/:id (protected)',
      'POST /api/services/:id/invoice (protected)',
      'GET /api/jobs (protected)',
      'GET /api/jobs/:id (protected)',
      'GET /api/calendar-feed',
      'POST /api/portal (protected)',
      'GET /api/sms/conversations (protected)',
      'GET /api/sms/messages/:phoneNumber (protected)',
      'POST /api/sms/send (protected)'
    ],
    timestamp: new Date().toISOString()
  }, 404);
});

export default app;
