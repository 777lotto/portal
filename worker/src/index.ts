/* ========================================================================
                        IMPORTS & INITIALIZATION
   ======================================================================== */

import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import manifest from '__STATIC_CONTENT_MANIFEST';
import type { Env, User } from '@portal/shared';
import { HTTPException } from 'hono/http-exception'; // --- ADDED: For centralized error handling

import { handleGoogleLogin, handleGoogleCallback, handleAdminImportSelectedContacts, handleGetImportedContacts } from './google/index.js';

/* ========================================================================
                           MIDDLEWARE & UTILITIES
   ======================================================================== */

// NOTE: The custom `errorResponse` utility can be phased out over time as
// individual handlers are refactored to simply `throw new HTTPException(...)`.
import { errorResponse } from './utils.js';
import { requireAuthMiddleware, requireAdminAuthMiddleware, requirePasswordSetTokenMiddleware } from './security/auth.js';

/* ========================================================================
                                PROXIES
   ======================================================================== */

import { handleSmsProxy } from './comms/sms.js';

/* ========================================================================
                               ROUTE HANDLERS
   ======================================================================== */

/* --------------------------------------------------------------------- Public Handlers */
import { handleLogin, handleSignup, handleRequestPasswordReset, handleResetPassword, handleVerifySignup } from './security/handler.js';
import { handleStripeWebhook } from './stripe/webhook.js';
import { handlePublicInquiry } from './public/index.js';

/* --------------------------------------------------------------------- Customer Handlers */
import { handleGetProfile, handleUpdateProfile } from './users/profile.js';
import { handleGetJobs, handleGetJobById, handleRequestRecurrence } from './jobs/jobs.js';
import { handleGetInvoiceById, handleGetInvoices } from './jobs/ledger/invoices.js';
import { handleGetQuoteById, handleGetQuotes, handleUpdateQuoteStatus } from './jobs/ledger/quotes.js';
import { handleGetPhotos, handleUploadPhoto, handleDeletePhoto } from './jobs/assets/photos.js';
import { handleGetNotes, handleAddNote } from './jobs/assets/notes.js';
import { handleGetCalendarEvents, handleGetAvailability, handleCreateBooking } from './jobs/timing/calendar.js';

/* --------------------------------------------------------------------- Admin Handlers */
import { handleAdminGetUsers, handleAdminGetUserById, handleAdminCreateUser, handleAdminUpdateUser, handleAdminDeleteUser, handleAdminAddNoteForUser } from './users/admin.js';
import { handleAdminGetJobs, handleAdminGetJobById, handleAdminCreateJob, handleAdminUpdateJob, handleAdminDeleteLineItemFromJob } from './jobs/admin/jobs.js';
import { handleAdminGetInvoices, handleAdminGetInvoiceById, handleAdminCreateInvoice, handleAdminUpdateInvoice, handleAdminDeleteInvoiceItem } from './jobs/admin/invoices.js';
import { handleAdminGetQuotes, handleAdminGetQuoteById, handleAdminCreateQuote, handleAdminUpdateQuote } from './jobs/admin/quotes.js';
import { handleRemoveCalendarEvent, handleAddCalendarEvent } from './jobs/timing/calendar.js';

/* ========================================================================
                       HONO APP & ERROR HANDLING
   ======================================================================== */

// --- REFACTORED: Centralized Error Handling ---
// The Hono app is initialized with a global .onError() handler.
// This single function will catch all errors thrown from any route.
const app = new Hono<Env>().onError((err, c) => {
	// Log the full error to the console for debugging.
	console.error(`[Hono Error] at ${c.req.url}: ${err.stack || err.message}`);

	// Check if the error is a known, intentional HTTP exception.
	if (err instanceof HTTPException) {
		// If so, return the response directly from the exception.
		// This is used for things like 404 Not Found, 401 Unauthorized, etc.
		return err.getResponse();
	}

	// For all other unexpected errors, return a generic 500 response.
	// This prevents leaking sensitive implementation details to the client.
	return c.json({ error: 'An internal server error occurred' }, 500);
});

// Apply CORS middleware to all routes
app.use('*', cors());

/* ========================================================================
                                API ROUTING
   ======================================================================== */

const api = new Hono<{ Bindings: Env }>();

/* --------------------------------------------------------------------- Public Routes */
const publicApi = new Hono<{ Bindings: Env }>();
publicApi.post('/login', handleLogin);
publicApi.post('/signup', handleSignup);
publicApi.post('/verify-signup', handleVerifySignup);
publicApi.post('/request-password-reset', handleRequestPasswordReset);
publicApi.post('/reset-password', requirePasswordSetTokenMiddleware, handleResetPassword);
publicApi.post('/stripe-webhook', handleStripeWebhook);
publicApi.post('/inquiry', handlePublicInquiry);

/* --------------------------------------------------------------------- Customer Routes */
const customerApi = new Hono<{ Bindings: Env }>();
customerApi.use('*', requireAuthMiddleware);

// Profile
customerApi.get('/profile', handleGetProfile);
customerApi.put('/profile', handleUpdateProfile);

// Jobs & Assets
customerApi.get('/jobs', handleGetJobs);
customerApi.get('/jobs/:id', handleGetJobById);
customerApi.get('/jobs/:jobId/photos', handleGetPhotos);
customerApi.post('/jobs/:jobId/photos', handleUploadPhoto);
customerApi.delete('/photos/:photoId', handleDeletePhoto);
customerApi.get('/jobs/:jobId/notes', handleGetNotes);
customerApi.post('/jobs/:jobId/notes', handleAddNote);

// Ledger (Invoices & Quotes)
customerApi.get('/invoices', handleGetInvoices);
customerApi.get('/invoices/:id', handleGetInvoiceById);
customerApi.get('/quotes', handleGetQuotes);
customerApi.get('/quotes/:id', handleGetQuoteById);
customerApi.put('/quotes/:id/status', handleUpdateQuoteStatus);

// Scheduling
customerApi.get('/calendar', handleGetCalendarEvents);
customerApi.get('/availability', handleGetAvailability);
customerApi.post('/bookings', handleCreateBooking);
customerApi.post('/request-recurrence', handleRequestRecurrence);

/* --------------------------------------------------------------------- Admin Routes */
const adminApi = new Hono<{ Bindings: Env }>();
adminApi.use('*', requireAdminAuthMiddleware);

// User Management
adminApi.get('/users', handleAdminGetUsers);
adminApi.get('/users/:user_id', handleAdminGetUserById);
adminApi.post('/users', handleAdminCreateUser);
adminApi.put('/users/:user_id', handleAdminUpdateUser);
adminApi.delete('/users/:user_id', handleAdminDeleteUser);
adminApi.post('/users/:user_id/notes', handleAdminAddNoteForUser);

// Job Management
adminApi.get('/jobs', handleAdminGetJobs);
adminApi.get('/jobs/:job_id', handleAdminGetJobById);
adminApi.post('/jobs', handleAdminCreateJob);
adminApi.put('/jobs/:job_id', handleAdminUpdateJob);
adminApi.delete('/jobs/:jobId/line-items/:lineItemId', handleAdminDeleteLineItemFromJob);

// Invoice & Quote Management
adminApi.get('/invoices', handleAdminGetInvoices);
adminApi.get('/invoices/:invoice_id', handleAdminGetInvoiceById);
adminApi.post('/invoices', handleAdminCreateInvoice);
adminApi.put('/invoices/:invoice_id', handleAdminUpdateInvoice);
adminApi.delete('/invoices/:invoiceId/items/:itemId', handleAdminDeleteInvoiceItem);
adminApi.get('/quotes', handleAdminGetQuotes);
adminApi.get('/quotes/:quote_id', handleAdminGetQuoteById);
adminApi.post('/quotes', handleAdminCreateQuote);
adminApi.put('/quotes/:quote_id', handleAdminUpdateQuote);

// Calendar & Google
adminApi.delete('/calendar-events/:eventId', handleRemoveCalendarEvent);
adminApi.post('/calendar-events', handleAddCalendarEvent);
adminApi.post('/google/import-contacts', handleAdminImportSelectedContacts);
adminApi.get('/google/imported-contacts', handleGetImportedContacts);

/* --------------------------------------------------------------------- Google & Proxies */
app.get('/auth/google', handleGoogleLogin);
app.get('/auth/google/callback', handleGoogleCallback);
app.post('/sms/proxy', handleSmsProxy);

/* ========================================================================
                              ROUTER REGISTRATION
   ======================================================================== */

api.route('/', publicApi);
api.route('/', customerApi);
api.route('/admin', adminApi);

app.route('/api', api);

/* ========================================================================
                             STATIC SITE SERVING
   ======================================================================== */

app.get('/*', serveStatic({ root: './', manifest }));
app.get('*', serveStatic({ path: './index.html', manifest }));

/* ========================================================================
                                   EXPORT
   ======================================================================== */

import { handleScheduled } from './cron/cron.js';

// Export the type of the API routes for the Hono RPC client
export type ApiRoutes = typeof api;

export default {
	fetch: app.fetch,
	scheduled: handleScheduled,
};
