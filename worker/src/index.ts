// worker/src/index.ts
/* ========================================================================
                        IMPORTS & INITIALIZATION
   ======================================================================== */

import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import manifest from '__STATIC_CONTENT_MANIFEST';
import type { Env, User } from '@portal/shared';
import { handleGoogleLogin, handleGoogleCallback, handleAdminImportSelectedContacts, handleGetImportedContacts } from './google/index.js';

/* ========================================================================
                           MIDDLEWARE & UTILITIES
   ======================================================================== */

import { errorResponse } from './utils.js';
import { requireAuthMiddleware, requireAdminAuthMiddleware, requirePasswordSetTokenMiddleware } from './security/auth.js';

/* ========================================================================
                                PROXIES
   ======================================================================== */

import { handleSmsProxy } from './comms/sms.js';

/* ========================================================================
                               ROUTE HANDLERS
   ======================================================================== */

/* --------------------------------------------------------------------- Public Handlers --------------------------------------------------------------------------------------- */
// login
import { handleInitializeSignup, handleLogin, handleRequestPasswordReset, handleLogout, handleSetPassword, handleCheckUser, handleVerifyResetCode, handleLoginWithToken } from './security/handler.js'
// jobs
import { getPendingQuotes, handleDeclineQuote, handleReviseQuote, getQuoteById, handleDownloadQuotePdf } from './jobs/ledger/quotes.js';
// payment
import { handleStripeWebhook } from './stripe/webhook.js';
// calendar
import { handleGetAvailability, handleCreateBooking, handlePublicCalendarFeed, handleAcceptQuote } from './public/index.js';
import { handleGetCustomerAvailability } from './jobs/timing/availability.js';

/* --------------------------------------------------------------------- Customer Handlers --------------------------------------------------------------------------------------- */
// users
// CORRECTED IMPORT: Added the new notification handlers
import { handleGetProfile, handleUpdateProfile, handleChangePassword, handleListPaymentMethods, handleCreateSetupIntent, handleMarkAllNotificationsRead, handleGetUiNotifications, handleMarkNotificationAsRead } from './users/profile.js';
import { handlePortalSession } from './users/user.js';
// jobs
import { handleGetJobs, handleGetJobById, handleAdminUpdateJobDetails, handleAdminAddLineItemToJob, handleAdminUpdateLineItemInJob, handleAdminDeleteLineItemFromJob, handleAdminCompleteJob, handleGetLineItemsForJob, handleGetOpenInvoicesForUser, handleCreateJob } from './jobs/jobs.js';
import { handleGetInvoiceForUser, handleCreatePaymentIntent, handleDownloadInvoicePdf } from './jobs/ledger/invoices.js';
// calendar
import { handleRequestRecurrence, handleGetRecurrenceRequests, handleUpdateRecurrenceRequest, handleGetUnavailableRecurrenceDays } from './jobs/timing/recurrence.js';
import { handleGetSecretCalendarUrl, handleRegenerateSecretCalendarUrl, handleCalendarFeed, handleGetCalendarEvents, handleAddCalendarEvent, handleRemoveCalendarEvent } from './jobs/timing/calendar.js';
//content
import { handleGetUserPhotos, handleGetPhotosForJob, handleChatAttachmentUpload } from './jobs/assets/photos.js';
import { handleGetNotesForJob } from './jobs/assets/notes.js';

/* --------------------------------------------------------------------- Admin Handlers --------------------------------------------------------------------------------------- */
// users
import { handleGetAllUsers, handleAdminDeleteUser, handleAdminCreateUser, handleAdminUpdateUser, handleAdminGetJobsForUser, handleAdminGetPhotosForUser, handleAdminGetNotesForUser } from './users/admin.js';
// jobs
import { handleGetAllJobDetails, handleAdminCreateJob, handleGetAllJobs } from './jobs/admin/jobs.js';
import { handleAdminImportQuotes, handleAdminSendQuote, handleAdminInvoiceJob, handleAdminCreateQuote } from './jobs/admin/quotes.js';
import { handleAdminImportInvoices, handleAdminGetInvoice, handleAdminAddInvoiceItem, handleAdminDeleteInvoiceItem, handleAdminFinalizeInvoice, handleAdminGetAllOpenInvoices, handleAdminMarkInvoiceAsPaid } from './jobs/admin/invoices.js';
import { handleGetDrafts } from './jobs/ledger/drafts.js';
// content
import { handleAdminUploadPhotoForUser } from './jobs/assets/photos.js';
import { handleAdminAddNoteForUser } from './jobs/assets/notes.js';

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
                          PROXY HANDLER FUNCTIONS
   ======================================================================== */

const handleNotificationProxy = async (c: Context<AppEnv>) => {
    const notificationService = c.env.NOTIFICATION_SERVICE;
    if (!notificationService) {
        return c.json({ error: "Notification service is unavailable" }, 503);
    }
    const newRequest = new Request(c.req.url, c.req.raw);
    const user = c.get('user');
    newRequest.headers.set('X-Internal-User-Id', user.id.toString());
    newRequest.headers.set('X-Internal-User-Role', user.role);
    return await notificationService.fetch(newRequest);
};

const handleChatProxy = async (c: Context<AppEnv>) => {
  const chatService = c.env.CUSTOMER_SUPPORT_CHAT;
  if (!chatService) {
    return c.json({ error: "Chat service is unavailable" }, 503);
  }
  const roomId = c.req.param('roomId');
  const room = chatService.idFromName(roomId);
  const stub = chatService.get(room);
  const token = c.req.query('token');
  const url = new URL(c.req.url);
  url.searchParams.set('token', token || '');
  return stub.fetch(url.toString(), c.req.raw);
};

/* ========================================================================
                                 APP SETUP
   ======================================================================== */

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


/* ========================================================================
                            PUBLIC API ROUTES
   ======================================================================== */

publicApi.get('/auth/google', handleGoogleLogin);
publicApi.get('/auth/google/callback', handleGoogleCallback);
publicApi.post('/signup/initialize', handleInitializeSignup);
publicApi.post('/login', handleLogin);
publicApi.post('/check-user', handleCheckUser);
publicApi.post('/request-password-reset', handleRequestPasswordReset);
publicApi.post('/verify-reset-code', handleVerifyResetCode);
publicApi.post('/login-with-token', requirePasswordSetTokenMiddleware, handleLoginWithToken);
publicApi.post('/set-password', requirePasswordSetTokenMiddleware, handleSetPassword);
publicApi.post('/stripe/webhook', handleStripeWebhook);
publicApi.get('/public/availability', handleGetAvailability);
publicApi.post('/public/booking', handleCreateBooking);
publicApi.get('/public/calendar/feed/:token', handlePublicCalendarFeed);
publicApi.post('/quotes/:quoteId/accept', handleAcceptQuote);


/* ========================================================================
                       CUSTOMER API ROUTES (Authenticated)
   ======================================================================== */

customerApi.get('/availability', handleGetCustomerAvailability);
customerApi.get('/profile', handleGetProfile);
customerApi.put('/profile', handleUpdateProfile);
customerApi.post('/profile/change-password', handleChangePassword);
customerApi.get('/jobs', handleGetJobs);
customerApi.post('/jobs', handleCreateJob);
customerApi.get('/jobs/unavailable-recurrence-days', handleGetUnavailableRecurrenceDays);
customerApi.get('/jobs/:id', handleGetJobById);
customerApi.get('/jobs/:id/photos', handleGetPhotosForJob);
customerApi.get('/jobs/:id/notes', handleGetNotesForJob);
customerApi.get('/jobs/:jobId/line-items', handleGetLineItemsForJob);
customerApi.post('/portal', handlePortalSession);
customerApi.post('/logout', handleLogout);
customerApi.get('/calendar.ics', handleCalendarFeed);
customerApi.get('/photos', handleGetUserPhotos);
customerApi.get('/calendar/secret-url', handleGetSecretCalendarUrl);
customerApi.post('/calendar/regenerate-url', handleRegenerateSecretCalendarUrl);
customerApi.get('/profile/payment-methods', handleListPaymentMethods);
customerApi.post('/profile/setup-intent', handleCreateSetupIntent);
// CORRECTED ROUTES: Pointing to the new, more specific handlers
customerApi.get('/notifications/ui', handleGetUiNotifications);
customerApi.post('/notifications/read-all', handleMarkAllNotificationsRead);
customerApi.post('/notifications/:id/read', handleMarkNotificationAsRead);
customerApi.get('/invoices/open', handleGetOpenInvoicesForUser);
customerApi.get('/invoices/:invoiceId', handleGetInvoiceForUser);
customerApi.post('/invoices/:invoiceId/create-payment-intent', handleCreatePaymentIntent);
customerApi.get('/invoices/:invoiceId/pdf', handleDownloadInvoicePdf);
customerApi.post('/jobs/:jobId/request-recurrence', handleRequestRecurrence);
customerApi.all('/sms/*', handleSmsProxy);
customerApi.all('/notifications/*', handleNotificationProxy);
customerApi.get('/quotes/pending', getPendingQuotes);
customerApi.get('/quotes/:quoteId', getQuoteById);
customerApi.get('/quotes/:quoteId/pdf', handleDownloadQuotePdf);
customerApi.post('/quotes/:quoteId/decline', handleDeclineQuote);
customerApi.post('/quotes/:quoteId/revise', handleReviseQuote);
customerApi.get('/chat/:roomId', handleChatProxy);
customerApi.post('/chat/upload', handleChatAttachmentUpload);


/* ========================================================================
                         ADMIN API ROUTES (Admin-Only)
   ======================================================================== */
// get
adminApi.get('/users', handleGetAllUsers);

adminApi.get('/jobs', handleGetAllJobs);
adminApi.get('/jobs/user/:user_id', handleAdminGetJobsForUser);
adminApi.get('/invoices/open', handleAdminGetAllOpenInvoices);
adminApi.get('/invoices/:invoiceId', handleAdminGetInvoice);
adminApi.get('/job-list-details', handleGetAllJobDetails);
adminApi.get('/drafts', handleGetDrafts);

adminApi.get('/calendar-events', handleGetCalendarEvents);
adminApi.get('/recurrence-requests', handleGetRecurrenceRequests);

adminApi.get('/photos/user/:user_id', handleAdminGetPhotosForUser);
adminApi.get('/notes/user/:user_id', handleAdminGetNotesForUser);

// put
adminApi.put('/users/:user_id', handleAdminUpdateUser);
adminApi.put('/jobs/:jobId/details', handleAdminUpdateJobDetails);
adminApi.put('/jobs/:jobId/line-items/:lineItemId', handleAdminUpdateLineItemInJob);
adminApi.put('/recurrence-requests/:requestId', handleUpdateRecurrenceRequest);

// post
adminApi.post('/users/:user_id/invoices/import', handleAdminImportInvoices);
adminApi.post('/get-imported-contacts', handleGetImportedContacts);
adminApi.post('/import-contacts', handleAdminImportSelectedContacts);
adminApi.post('/users', handleAdminCreateUser);

adminApi.post('/jobs/:jobId/quote', handleAdminCreateQuote);
adminApi.post('/quotes/import', handleAdminImportQuotes);
adminApi.post('/invoices/import', handleAdminImportInvoices);
adminApi.post('/jobs', handleAdminCreateJob);
adminApi.post('/jobs/:jobId/line-items', handleAdminAddLineItemToJob);
adminApi.post('/jobs/:jobId/complete', handleAdminCompleteJob);
adminApi.post('/jobs/:jobId/quote/send', handleAdminSendQuote);
adminApi.post('/jobs/:jobId/invoice', handleAdminInvoiceJob);
adminApi.post('/invoices/:invoiceId/items', handleAdminAddInvoiceItem);
adminApi.post('/invoices/:invoiceId/finalize', handleAdminFinalizeInvoice);
adminApi.post('/invoices/:invoiceId/mark-as-paid', handleAdminMarkInvoiceAsPaid);

adminApi.post('/users/:user_id/photos', handleAdminUploadPhotoForUser);
adminApi.post('/users/:user_id/notes', handleAdminAddNoteForUser);

// delete
adminApi.delete('/users/:user_id', handleAdminDeleteUser);

adminApi.delete('/jobs/:jobId/line-items/:lineItemId', handleAdminDeleteLineItemFromJob);
adminApi.delete('/invoices/:invoiceId/items/:itemId', handleAdminDeleteInvoiceItem);

adminApi.delete('/calendar-events/:eventId', handleRemoveCalendarEvent);
adminApi.post('/calendar-events', handleAddCalendarEvent);

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

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
