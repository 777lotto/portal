// worker/src/index.ts - Main Worker API
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

// Add CORS middleware
app.use('/*', cors());

// Health check
app.get('/ping', (c) => c.json({ status: 'ok' }));

// Auth endpoints
app.post('/signup/check', async (c) => {
  return handleSignupCheck(c.req.raw, c.env);
});

app.post('/signup', async (c) => {
  return handleSignup(c.req.raw, c.env);
});

app.post('/login', async (c) => {
  return handleLogin(c.req.raw, c.env);
});

// Stripe endpoints
app.post('/stripe/check-customer', async (c) => {
  return handleStripeCustomerCheck(c.req.raw, c.env);
});

app.post('/stripe/webhook', async (c) => {
  return handleStripeWebhook(c.req.raw, c.env);
});

// Protected endpoints
app.use('/profile/*', async (c, next) => {
  try {
    const email = await requireAuth(c.req.raw, c.env);
    c.set('userEmail', email);
    await next();
  } catch (error: any) {
    return c.json({ error: error.message }, 401);
  }
});

app.use('/services/*', async (c, next) => {
  try {
    const email = await requireAuth(c.req.raw, c.env);
    c.set('userEmail', email);
    await next();
  } catch (error: any) {
    return c.json({ error: error.message }, 401);
  }
});

app.use('/jobs/*', async (c, next) => {
  try {
    const email = await requireAuth(c.req.raw, c.env);
    c.set('userEmail', email);
    await next();
  } catch (error: any) {
    return c.json({ error: error.message }, 401);
  }
});

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
    const email = await requireAuth(c.req.raw, c.env);
    
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
    const email = await requireAuth(c.req.raw, c.env);
    
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
    const email = await requireAuth(c.req.raw, c.env);
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
    const email = await requireAuth(c.req.raw, c.env);
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

export default app;
