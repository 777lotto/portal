import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorResponse } from './utils';
import { requireAuthMiddleware, requireAdminAuthMiddleware } from './auth';
import { handleSignup, handleLogin, handleRequestPasswordReset } from './handlers/auth';
import { handleGetProfile, handleUpdateProfile } from './handlers/profile';
import { handleStripeWebhook } from './handlers/stripe';
import { handleListServices, handleGetService, handleCreateInvoice, handleGetPhotosForService, handleGetNotesForService } from './handlers/services';
import { handleGetJobs, handleGetJobById, handleCalendarFeed } from './handlers/jobs';
import { handleGetAllUsers } from './handlers/admin/users';
import { handleGetPhotosForJob, handleAdminUploadPhoto } from './handlers/photos';
import { handleGetNotesForJob, handleAdminAddNote } from './handlers/notes';
import { handlePortalSession } from './handlers/user';
import { handleSmsProxy } from './sms';

// Import the single source of truth for types
import type { Env, User } from '@portal/shared';

// This is the correct way to type your Hono application context.
export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: User; // The user object we'll attach in middleware
  };
};

const app = new Hono<AppEnv>();

// --- GLOBAL MIDDLEWARE ---
app.use('/*', cors({ origin: '*' }));

// --- ROUTERS ---
const publicApi = new Hono<AppEnv>();
const customerApi = new Hono<AppEnv>();
const adminApi = new Hono<AppEnv>();

// --- MIDDLEWARE FOR PROTECTED ROUTES ---
customerApi.use('*', requireAuthMiddleware);

// =================== FIX: This is the critical change ===================
// Apply BOTH middleware functions to the admin routes in sequence.
adminApi.use('*', requireAuthMiddleware);      // 1. First, require a valid login.
adminApi.use('*', requireAdminAuthMiddleware); // 2. Then, require that the user is an admin.
// =======================================================================


// --- PUBLIC ROUTES ---
publicApi.post('/signup', handleSignup);
publicApi.post('/login', handleLogin);
publicApi.post('/request-password-reset', handleRequestPasswordReset);
publicApi.post('/stripe/webhook', handleStripeWebhook);
publicApi.get('/calendar.ics', handleCalendarFeed); // Public calendar feed

// --- CUSTOMER ROUTES (Authenticated Users) ---
customerApi.get('/profile', handleGetProfile);
customerApi.put('/profile', handleUpdateProfile);
customerApi.get('/services', handleListServices);
customerApi.get('/services/:id', handleGetService);
customerApi.post('/services/:id/invoice', handleCreateInvoice);
customerApi.get('/services/:id/photos', handleGetPhotosForService);
customerApi.get('/services/:id/notes', handleGetNotesForService);
customerApi.get('/jobs', handleGetJobs);
customerApi.get('/jobs/:id', handleGetJobById);
customerApi.get('/jobs/:id/photos', handleGetPhotosForJob);
customerApi.get('/jobs/:id/notes', handleGetNotesForJob);
customerApi.post('/portal', handlePortalSession);
customerApi.all('/sms/*', handleSmsProxy); // Proxy SMS requests

// --- ADMIN ROUTES ---
adminApi.get('/users', handleGetAllUsers);
adminApi.post('/jobs/:jobId/photos', handleAdminUploadPhoto);
adminApi.post('/jobs/:jobId/notes', handleAdminAddNote);

// --- ROUTE REGISTRATION ---
app.route('/api', publicApi);
app.route('/api', customerApi);
app.route('/api/admin', adminApi);

// --- 404 & ERROR HANDLING ---
app.notFound((c) => c.json({ error: 'Route not found' }, 404));
app.onError((err, c) => {
  console.error(`Hono Error: ${err}`, c.req.url);
  return errorResponse('An internal server error occurred', 500);
});

export default app;
