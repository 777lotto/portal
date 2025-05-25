// worker/src/index.ts - Fixed TypeScript imports and types
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from '@portal/shared';
import { requireAuth } from './auth';
import { handleSignupCheck, handleSignup, handleLogin } from './handlers/auth';
import { handleStripeCustomerCheck, handleStripeWebhook } from './handlers/stripe';
import { handleGetProfile, handleUpdateProfile } from './handlers/profile';
import { handleListServices, handleGetService, handleCreateInvoice } from './handlers/services';
import { handleGetJobs, handleGetJobById, handleCalendarFeed } from './handlers/jobs';

const app = new Hono<{ Bindings: Env }>();

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
    
    // Import and use the stripe helper
    const { getOrCreateCustomer } = await import('./stripe');
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
    const email = c.get('userEmail');
    return await handleGetProfile(c.req.raw, c.env, email);
  } catch (error: any) {
    console.error('❌ Profile GET error:', error);
    return c.json({ error: error.message || 'Profile fetch failed' }, 500);
  }
});

app.put('/profile', requireAuthMiddleware, async (c) => {
  console.log('✅ Profile PUT endpoint hit');
  try {
    const email = c.get('userEmail');
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
    const email = c.get('userEmail');
    return await handleListServices(c.req.raw, c.env, email);
  } catch (error: any) {
    console.error('❌ Services GET error:', error);
    return c.json({ error: error.message || 'Services fetch failed' }, 500);
  }
});

app.get('/services/:id', requireAuthMiddleware, async (c) => {
  console.log('✅ Service detail GET endpoint hit');
  try {
    const email = c.get('userEmail');
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
    const email = c.get('userEmail');
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
    const email = c.get('userEmail');
    
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
    const email = c.get('userEmail');
    
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

      const data = await response.json();
      return c.json(data, response.status);
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
