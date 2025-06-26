// worker/src/index.ts - CORRECTED Hono App Definition

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, User } from '@portal/shared';
import { requireAuthMiddleware, requireAdminAuthMiddleware } from './auth';
import { handleSignup, handleLogin, handleRequestPasswordReset } from './handlers/auth';
import { handleStripeWebhook } from './handlers/stripe';
import { handleGetProfile, handleUpdateProfile } from './handlers/profile';
import { handleListServices, handleGetService, handleCreateInvoice, handleGetPhotosForService, handleGetNotesForService } from './handlers/services';
import { handleGetJobs, handleGetJobById, handleCalendarFeed } from './handlers/jobs';
import { handlePortalSession, handleSmsProxy } from './handlers/user';
import { handleGetPhotosForJob, handleAdminUploadPhoto } from './handlers/photos';
import { handleGetNotesForJob, handleAdminAddNote } from './handlers/notes';
import { handleGetAllUsers } from './handlers/admin/users';
import { errorResponse } from './utils';

// --- CONTEXT TYPING ---
// This is the standard Hono way to define the app's environment.
// It makes `c.env`, `c.get()`, `c.set()` etc. fully typed in all handlers.
export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: User; // The payload from the JWT
  };
};

// FIX: Initialize Hono with the correct generic type
const app = new Hono<AppEnv>();

// --- GLOBAL MIDDLEWARE ---
app.use('/*', cors({ origin: '*' }));

// --- ROUTERS ---
const publicApi = new Hono<AppEnv>();
const customerApi = new Hono<AppEnv>();
const adminApi = new Hono<AppEnv>();

// --- MIDDLEWARE FOR PROTECTED ROUTES ---
customerApi.use('*', requireAuthMiddleware);
adminApi.use('*', requireAdminAuthMiddleware);


// --- PUBLIC ROUTES ---
publicApi.post('/signup', (c) => handleSignup(c));
publicApi.post('/login', (c) => handleLogin(c));
publicApi.post('/request-password-reset', (c) => handleRequestPasswordReset(c));
publicApi.post('/stripe/webhook', (c) => handleStripeWebhook(c));

// --- CUSTOMER ROUTES ---
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
customerApi.get('/calendar-feed', handleCalendarFeed);
customerApi.post('/portal', handlePortalSession);
customerApi.get('/sms/conversations', handleSmsProxy);

// --- ADMIN ROUTES ---
adminApi.get('/users', handleGetAllUsers);
adminApi.post('/users/:userId/photos', handleAdminUploadPhoto);
adminApi.post('/users/:userId/notes', handleAdminAddNote);


// --- ROUTE REGISTRATION ---
app.route('/api', publicApi);
app.route('/api', customerApi);
app.route('/api/admin', adminApi);

// --- 404 & ERROR HANDLING ---
app.notFound((c) => c.json({ error: 'Route not found' }, 404));
app.onError((err, c) => {
  console.error('Unhandled Exception:', err);
  return errorResponse('An internal server error occurred', 500);
});

export default app;
