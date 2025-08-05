/* ========================================================================
                        IMPORTS & INITIALIZATION
   ======================================================================== */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import manifest from '__STATIC_CONTENT_MANIFEST';
import type { Env, User } from '@portal/shared';
import { HTTPException } from 'hono/http-exception';

import { handleGoogleLogin, handleGoogleCallback, handleAdminImportSelectedContacts, handleGetImportedContacts } from './google/index.js';

/* ========================================================================
                           MIDDLEWARE & UTILITIES
   ======================================================================== */

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
import { handlePublicInquiry, acceptQuote } from './public/index.js';

/* --------------------------------------------------------------------- Customer Handlers */
import { getProfile, updateProfile } from './users/profile.js';
import { getJobs, getJobById, requestRecurrence } from './jobs/jobs.js';
import { getInvoice, createPaymentIntent, downloadInvoicePdf, getOpenInvoices } from './jobs/ledger/invoices.js';
import { getQuote, getQuotes, declineQuote, requestQuoteRevision } from './jobs/ledger/quotes.js';
import { getPhotos, uploadPhoto, deletePhoto } from './jobs/assets/photos.js';
import { getNotes, addNote } from './jobs/assets/notes.js';
import { getCalendarEvents, getAvailability, createBooking } from './jobs/timing/calendar.js';

/* --------------------------------------------------------------------- Admin Handlers */
import { getAllUsers, getUserById, createUser, updateUser, deleteUser, addNoteToUser } from './users/admin.js';
import { getAllJobs, createJob as createAdminJob, getJobById as getAdminJobById, updateJob as updateAdminJob, deleteLineItemFromJob } from './jobs/admin/jobs.js';
import { getInvoice as getAdminInvoice, addInvoiceItem, deleteInvoiceItem, finalizeInvoice, markInvoiceAsPaid, importInvoices } from './jobs/admin/invoices.js';
import { createQuote, sendQuote, getQuotes as getAdminQuotes, getQuoteById as getAdminQuoteById, updateQuote as updateAdminQuote } from './jobs/admin/quotes.js';
import { removeCalendarEvent, addCalendarEvent } from './jobs/timing/calendar.js';


/* ========================================================================
                       ENVIRONMENT & CLOUDFLARE TYPES
   ======================================================================== */

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: User;
  };
};

/* ========================================================================
                       HONO APP & ERROR HANDLING
   ======================================================================== */

const app = new Hono<AppEnv>().onError((err, c) => {
	console.error(`[Hono Error] at ${c.req.path}: ${err.stack || err.message}`);
	if (err instanceof HTTPException) {
		return err.getResponse();
	}
	return c.json({ error: 'An internal server error occurred' }, 500);
});

// Apply CORS middleware to all routes
app.use('*', cors());

/* ========================================================================
                                API ROUTING
   ======================================================================== */

const api = new Hono<AppEnv>();

/* --------------------------------------------------------------------- Public Routes */
const publicApi = new Hono<AppEnv>();
publicApi.post('/login', handleLogin);
publicApi.post('/signup', handleSignup);
publicApi.post('/verify-signup', handleVerifySignup);
publicApi.post('/request-password-reset', handleRequestPasswordReset);
publicApi.post('/reset-password', requirePasswordSetTokenMiddleware, handleResetPassword);
publicApi.post('/stripe-webhook', handleStripeWebhook);
publicApi.post('/inquiry', handlePublicInquiry);
publicApi.post('/quotes/:id/accept', acceptQuote);


/* --------------------------------------------------------------------- Customer Routes */
const customerApi = new Hono<AppEnv>();
customerApi.use('*', requireAuthMiddleware);

// Profile
customerApi.get('/profile', getProfile);
customerApi.put('/profile', updateProfile);

// Jobs & Assets
customerApi.get('/jobs', getJobs);
customerApi.get('/jobs/:id', getJobById);
customerApi.get('/jobs/:jobId/photos', getPhotos);
customerApi.post('/jobs/:jobId/photos', uploadPhoto);
customerApi.delete('/photos/:photoId', deletePhoto);
customerApi.get('/jobs/:jobId/notes', getNotes);
customerApi.post('/jobs/:jobId/notes', addNote);

// Ledger (Invoices & Quotes)
customerApi.get('/invoices', getOpenInvoices);
customerApi.get('/invoices/:id', getInvoice);
customerApi.post('/invoices/:id/pay', createPaymentIntent);
customerApi.get('/invoices/:id/pdf', downloadInvoicePdf);
customerApi.get('/quotes', getQuotes);
customerApi.get('/quotes/:id', getQuote);
customerApi.put('/quotes/:id/decline', declineQuote);
customerApi.post('/quotes/:id/request-revision', requestQuoteRevision);


// Scheduling
customerApi.get('/calendar', getCalendarEvents);
customerApi.get('/availability', getAvailability);
customerApi.post('/bookings', createBooking);
customerApi.post('/request-recurrence', requestRecurrence);

/* --------------------------------------------------------------------- Admin Routes */
const adminApi = new Hono<AppEnv>();
adminApi.use('*', requireAdminAuthMiddleware);

// User Management
adminApi.get('/users', getAllUsers);
adminApi.get('/users/:user_id', getUserById);
adminApi.post('/users', createUser);
adminApi.put('/users/:user_id', updateUser);
adminApi.delete('/users/:user_id', deleteUser);
adminApi.post('/users/:user_id/notes', addNoteToUser);

// Job Management
adminApi.get('/jobs', getAllJobs);
adminApi.get('/jobs/:job_id', getAdminJobById);
adminApi.post('/jobs', createAdminJob);
adminApi.put('/jobs/:job_id', updateAdminJob);
adminApi.delete('/jobs/:jobId/line-items/:lineItemId', deleteLineItemFromJob);


// Invoice & Quote Management
adminApi.get('/invoices', getOpenInvoices);
adminApi.get('/invoices/:invoice_id', getAdminInvoice);
adminApi.post('/invoices/:invoice_id/items', addInvoiceItem);
adminApi.post('/invoices', importInvoices);
adminApi.put('/invoices/:invoice_id/finalize', finalizeInvoice);
adminApi.put('/invoices/:invoice_id/mark-paid', markInvoiceAsPaid);
adminApi.delete('/invoices/:invoiceId/items/:itemId', deleteInvoiceItem);

adminApi.get('/quotes', getAdminQuotes);
adminApi.get('/quotes/:quote_id', getAdminQuoteById);
adminApi.post('/quotes', createQuote);
adminApi.put('/quotes/:quote_id/send', sendQuote);
adminApi.put('/quotes/:quote_id', updateAdminQuote);


// Calendar & Google
adminApi.delete('/calendar-events/:eventId', removeCalendarEvent);
adminApi.post('/calendar-events', addCalendarEvent);
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

// Export the type of the API routes for the Hono RPC client
export type ApiRoutes = typeof api;

export default app;
