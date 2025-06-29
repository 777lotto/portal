/**
 * Main application entry point for the Cloudflare Worker.
 * This file sets up the Hono router, defines API routes, and configures
 * middleware for serving both the backend API and the frontend React application.
 */

// --- 1. IMPORTS ---
import { Hono } from 'hono';
import { cors } from 'hono/cors';
// Import serveStatic for serving frontend assets
import { serveStatic } from 'hono/cloudflare-workers';
import manifest from '__STATIC_CONTENT_MANIFEST';

// Import handlers and utilities
import { errorResponse } from './utils';
import { requireAuthMiddleware, requireAdminAuthMiddleware } from './auth';
import { handleSignup, handleLogin, handleRequestPasswordReset, handleLogout } from './handlers/auth';
import { handleGetProfile, handleUpdateProfile } from './handlers/profile';
import { handleStripeWebhook } from './handlers/stripe';
import { handleListServices, handleGetService, handleCreateInvoice, handleGetPhotosForService, handleGetNotesForService } from './handlers/services';
import { handleGetJobs, handleGetJobById, handleCalendarFeed } from './handlers/jobs';
import { handleGetAllUsers } from './handlers/admin/users';
import { handleGetPhotosForJob, handleAdminUploadPhoto } from './handlers/photos';
import { handleGetNotesForJob, handleAdminAddNote } from './handlers/notes';
import { handlePortalSession } from './handlers/user';
import { handleSmsProxy } from './sms';

// Import shared types
import type { Env, User } from '@portal/shared';

// --- 2. TYPE DEFINITIONS ---
// Define the application environment for Hono, providing types for bindings and variables.
export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: User; // The user object attached by auth middleware
  };
};

// --- 3. HONO APP INITIALIZATION ---
const app = new Hono<AppEnv>().onError((err, c) => {
  // Centralized error handling for the entire application.
  console.error(`Hono Error: ${err}`, c.req.url, err.stack);
  return errorResponse('An internal server error occurred', 500);
});

// --- 4. GLOBAL MIDDLEWARE ---
// Apply CORS to all incoming requests to allow cross-origin communication.
app.use('*', cors());

// --- 5. API ROUTER SETUP ---
// Group all API endpoints under a single parent router for organization.
const api = new Hono<AppEnv>();

// Define sub-routers for different access levels
const publicApi = new Hono<AppEnv>();
const customerApi = new Hono<AppEnv>();
const adminApi = new Hono<AppEnv>();

// Apply authentication middleware to protected routers
customerApi.use('*', requireAuthMiddleware);
adminApi.use('*', requireAuthMiddleware, requireAdminAuthMiddleware); // Chain middleware for admin

/* --- Public API Routes --- */
publicApi.post('/signup', handleSignup);
publicApi.post('/login', handleLogin);
publicApi.post('/request-password-reset', handleRequestPasswordReset);
publicApi.post('/stripe/webhook', handleStripeWebhook);
publicApi.get('/calendar.ics', handleCalendarFeed);

/* --- Customer API Routes (Authenticated) --- */
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
customerApi.all('/sms/*', handleSmsProxy);
customerApi.post('/logout', handleLogout);

/* --- Admin API Routes (Admin-Only) --- */
adminApi.get('/users', handleGetAllUsers);
adminApi.post('/jobs/:jobId/photos', handleAdminUploadPhoto);
adminApi.post('/jobs/:jobId/notes', handleAdminAddNote);

// Attach the sub-routers to the main API router
api.route('/', publicApi);
api.route('/', customerApi);
api.route('/', adminApi);

// Register the master API router with the main app under the "/api" base path.
app.route('/api', api);


// --- 6. FRONTEND SERVING LOGIC ---
app.use('/*', serveStatic({ root: './', manifest }));
app.get('*', serveStatic({ path: './index.html', manifest }));


// --- 7. EXPORT ---
export default app;
