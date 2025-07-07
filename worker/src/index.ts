/**
 * Main application entry point for the Cloudflare Worker.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import manifest from '__STATIC_CONTENT_MANIFEST';

import { errorResponse } from './utils.js';
import { requireAuthMiddleware, requireAdminAuthMiddleware } from './auth.js';
import { handleSignup, handleLogin, handleRequestPasswordReset, handleLogout } from './handlers/auth.js';
import { handleGetProfile, handleUpdateProfile } from './handlers/profile.js';
import { handleStripeWebhook } from './handlers/stripe.js';
import { handleListServices, handleGetService, handleCreateInvoice, handleGetPhotosForService, handleGetNotesForService } from './handlers/services.js';
// --- NEW: Import handleCreateJob ---
import { handleGetJobs, handleGetJobById, handleCalendarFeed, handleCreateJob } from './handlers/jobs.js';
import { handleGetAllUsers } from './handlers/admin/users.js';
import { handleGetPhotosForJob, handleAdminUploadPhoto } from './handlers/photos.js';
import { handleGetNotesForJob, handleAdminAddNote } from './handlers/notes.js';
import { handlePortalSession } from './handlers/user.js';
import { handleSmsProxy } from './sms.js';
import { handleGetAvailability, handleCreateBooking } from './handlers/public.js';
import type { Env, User } from '@portal/shared';

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: User;
  };
};

const app = new Hono<AppEnv>().onError((err, c) => {
  console.error(`Hono Error: ${err}`, c.req.url, err.stack);
  return errorResponse('An internal server error occurred', 500);
});

app.use('*', cors());

const api = new Hono<AppEnv>();
const publicApi = new Hono<AppEnv>();
const customerApi = new Hono<AppEnv>();
const adminApi = new Hono<AppEnv>();

customerApi.use('*', requireAuthMiddleware);
adminApi.use('*', requireAuthMiddleware, requireAdminAuthMiddleware);

/* --- Public API Routes --- */
publicApi.post('/signup', handleSignup);
publicApi.post('/login', handleLogin);
publicApi.post('/request-password-reset', handleRequestPasswordReset);
publicApi.post('/stripe/webhook', handleStripeWebhook);
publicApi.get('/public/availability', handleGetAvailability);
publicApi.post('/public/booking', handleCreateBooking);

/* --- Customer API Routes (Authenticated) --- */
customerApi.get('/profile', handleGetProfile);
customerApi.put('/profile', handleUpdateProfile);
customerApi.get('/services', handleListServices);
customerApi.get('/services/:id', handleGetService);
customerApi.post('/services/:id/invoice', handleCreateInvoice);
customerApi.get('/services/:id/photos', handleGetPhotosForService);
customerApi.get('/services/:id/notes', handleGetNotesForService);
customerApi.get('/jobs', handleGetJobs);

// --- NEW: Route to create a job ---
customerApi.post('/jobs', handleCreateJob);
customerApi.get('/jobs/:id', handleGetJobById);
customerApi.get('/jobs/:id/photos', handleGetPhotosForJob);
customerApi.get('/jobs/:id/notes', handleGetNotesForJob);
customerApi.post('/portal', handlePortalSession);
customerApi.all('/sms/*', handleSmsProxy);
customerApi.post('/logout', handleLogout);
customerApi.get('/calendar.ics', handleCalendarFeed);

/* --- Admin API Routes (Admin-Only) --- */
adminApi.get('/users', handleGetAllUsers);
adminApi.post('/jobs/:jobId/photos', handleAdminUploadPhoto);
adminApi.post('/jobs/:jobId/notes', handleAdminAddNote);

api.route('/', publicApi);
api.route('/', customerApi);
api.route('/', adminApi);

app.route('/api', api);

app.get('/*', serveStatic({
    root: './',
    manifest,
}));

app.get('*', serveStatic({
    path: './index.html',
    manifest,
}));

export default app;
