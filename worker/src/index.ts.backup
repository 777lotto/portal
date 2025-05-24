// worker/src/index.ts - Fixed API routing and error handling
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from '@portal/shared';
import { requireAuth } from './auth';
import { handleSignupCheck, handleSignup, handleLogin } from './handlers/auth';
import { handleStripeCustomerCheck, handleStripeWebhook } from './handlers/stripe';
import { handleGetProfile, handleUpdateProfile } from './handlers/profile';
import { handleListServices, handleGetService, handleCreateInvoice } from './handlers/services';
import { handleGetJobs, handleGetJobById, handleCalendarFeed } from './handlers/jobs';

const app = new Hono<{ Bindings: Env }>();

// Add CORS middleware with more permissive settings
app.use('*', cors({
  origin: ['https://portal.777.foo', 'http://localhost:5173', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Add error handling middleware
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

// Health check
app.get('/ping', (c) => {
  console.log('Health check requested');
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint
app.get('/debug', async (c) => {
  try {
    // Test database connection
    const dbTest = await c.env.DB.prepare('SELECT 1 as test').first();
    
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        hasDB: !!c.env.DB,
        hasJWTSecret: !!c.env.JWT_SECRET,
        hasTurnstileSecret: !!c.env.TURNSTILE_SECRET_KEY,
        hasStripeSecret: !!c.env.STRIPE_SECRET_KEY,
        hasNotificationWorker: !!c.env.NOTIFICATION_WORKER,
        hasPaymentWorker: !!c.env.PAYMENT_WORKER,
      },
      database: {
        connected: !!dbTest,
        testResult: dbTest
      },
      headers: {
        host: c.req.header('host'),
        userAgent: c.req.header('user-agent'),
        cfConnectingIp: c.req.header('cf-connecting-ip'),
      }
    });
  } catch (error: any) {
    return c.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Auth endpoints - these should be accessible without auth
app.post('/signup/check', async (c) => {
  console.log('Signup check requested');
  try {
    return await handleSignupCheck(c.req.raw, c.env);
  } catch (error: any) {
    console.error('Signup check error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/signup', async (c) => {
  console.log('Signup requested');
  try {
    return await handleSignup(c.req.raw, c.env);
  } catch (error: any) {
    console.error('Signup error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/login', async (c) => {
  console.log('Login requested');
  try {
    return await handleLogin(c.req.raw, c.env);
  } catch (error: any) {
    console.error('Login error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Stripe endpoints
app.post('/stripe/check-customer', async (c) => {
  console.log('Stripe customer check requested');
  try {
    return await handleStripeCustomerCheck(c.req.raw, c.env);
  } catch (error: any) {
    console.error('Stripe customer check error:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post('/stripe/webhook', async (c) => {
  console.log('Stripe webhook requested');
  try {
    return await handleStripeWebhook(c.req.raw, c.env);
  } catch (error: any) {
    console.error('Stripe webhook error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Auth middleware for protected routes
const authMiddleware = async (c: any, next: any) => {
  try {
    const email = await requireAuth(c.req.raw, c.env);
    c.set('userEmail', email);
    await next();
  } catch (error: any) {
    console.error('Auth middleware error:', error);
    return c.json({ error: 'Authentication failed: ' + error.message }, 401);
  }
};

// Protected endpoints
app.use('/profile/*', authMiddleware);
app.use('/services/*', authMiddleware);
app.use('/jobs/*', authMiddleware);
app.use('/portal', authMiddleware);
app.use('/sms/*', authMiddleware);

// Profile endpoints
app.get('/profile', async (c) => {
  const email = c.get('userEmail');
  return handleGetProfile(c.req.raw, c.env, email);
});

app.put('/profile', async (c) => {
  const email = c.get('userEmail');
  return handleUpdateProfile(c.req.raw, c.env, email);
});

// Services endpoints
app.get('/services', async (c) => {
  const email = c.get('userEmail');
  return handleListServices(c.req.raw, c.env, email);
});

app.get('/services/:id', async (c) => {
  const email = c.get('userEmail');
  const id = parseInt(c.req.param('id'));
  return handleGetService(c.req.raw, c.env, email, id);
});

app.post('/services/:id/invoice', async (c) => {
  const email = c.get('userEmail');
  const serviceId = parseInt(c.req.param('id'));
  return handleCreateInvoice(c.req.raw, c.env, email, serviceId);
});

// Jobs/Calendar endpoints
app.get('/jobs', async (c) => {
  return handleGetJobs(c.req.raw, c.env);
});

app.get('/jobs/:id', async (c) => {
  const url = new URL(c.req.url);
  return handleGetJobById(c.req.raw, url, c.env);
});

app.get('/calendar-feed', async (c) => {
  const url = new URL(c.req.url);
  return handleCalendarFeed(c.req.raw, url, c.env);
});

// Stripe Customer Portal
app.post('/portal', async (c) => {
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
    console.error("Portal error:", error);
    return c.json({ error: error.message }, 400);
  }
});

// SMS endpoints that proxy to notification worker
app.get('/sms/conversations', async (c) => {
  try {
    const email = c.get('userEmail');
    
    // Get user ID
    const userRow = await c.env.DB.prepare(
      `SELECT id FROM users WHERE lower(email) = ?`
    ).bind(email.toLowerCase()).first();

    if (!userRow) {
      return c.json({ error: "User not found" }, 404);
    }

    // Proxy to notification worker
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
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.get('/sms/messages/:phoneNumber', async (c) => {
  try {
    const email = c.get('userEmail');
    const phoneNumber = c.req.param('phoneNumber');
    
    // Get user ID
    const userRow = await c.env.DB.prepare(
      `SELECT id FROM users WHERE lower(email) = ?`
    ).bind(email.toLowerCase()).first();

    if (!userRow) {
      return c.json({ error: "User not found" }, 404);
    }

    // Proxy to notification worker
    const response = await c.env.NOTIFICATION_WORKER.fetch(
      new Request(`https://portal.777.foo/api/notifications/sms/messages/${phoneNumber}?userId=${(userRow as any).id}`, {
        method: 'GET',
        headers: {
          'Authorization': c.req.header('Authorization') || '',
        },
      })
    );

    const data = await response.json();
    return c.json(data, response.status);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/sms/send', async (c) => {
  try {
    const email = c.get('userEmail');
    const body = await c.req.json();
    
    // Get user ID
    const userRow = await c.env.DB.prepare(
      `SELECT id FROM users WHERE lower(email) = ?`
    ).bind(email.toLowerCase()).first();

    if (!userRow) {
      return c.json({ error: "User not found" }, 404);
    }

    // Proxy to notification worker with user ID
    const response = await c.env.NOTIFICATION_WORKER.fetch(
      new Request('https://portal.777.foo/api/notifications/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': c.req.header('Authorization') || '',
        },
        body: JSON.stringify({
          ...body,
          userId: (userRow as any).id
        })
      })
    );

    const data = await response.json();
    return c.json(data, response.status);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Catch-all for debugging
app.all('*', (c) => {
  console.log(`Unhandled request: ${c.req.method} ${c.req.url}`);
  return c.json({ 
    error: 'Not found', 
    method: c.req.method, 
    path: c.req.url,
    timestamp: new Date().toISOString()
  }, 404);
});

export default app;
