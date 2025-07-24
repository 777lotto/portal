// 777lotto/portal/portal-fold/worker/src/index.ts
/* ========================================================================
                        IMPORTS & INITIALIZATION
   ======================================================================== */

import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import manifest from '__STATIC_CONTENT_MANIFEST';
import type { Env, User } from '@portal/shared';
import { handleGoogleLogin, handleGoogleCallback, handleAdminImportSelectedContacts, handleGetImportedContacts } from './handlers/google.js';
import { CustomerSupportChat } from './chat.js';

/* ========================================================================
                           MIDDLEWARE & UTILITIES
   ======================================================================== */

import { errorResponse } from './utils.js';
import { requireAuthMiddleware, requireAdminAuthMiddleware, requirePasswordSetTokenMiddleware } from './auth.js';

/* ========================================================================
                                PROXIES
   ======================================================================== */

import { handleSmsProxy } from './sms.js';

/* ========================================================================
                               ROUTE HANDLERS
   ======================================================================== */

// --- Public Handlers ---
import { handleInitializeSignup, handleLogin, handleRequestPasswordReset, handleLogout, handleSetPassword, handleCheckUser, handleVerifyResetCode, handleLoginWithToken } from './handlers/auth.js';
import { handleStripeWebhook } from './handlers/stripe.js';
import { handleGetAvailability, handleCreateBooking, handlePublicCalendarFeed, handleAcceptQuote } from './handlers/public.js';

// --- Customer Handlers ---
import { handleGetProfile, handleUpdateProfile, handleChangePassword, handleListPaymentMethods, handleCreateSetupIntent, handleGetNotifications, handleMarkAllNotificationsRead } from './handlers/profile.js';
import { handleListServices, handleGetService } from './handlers/services.js';
import {
    handleGetJobs, handleGetJobById, handleCalendarFeed, handleCreateJob,
    handleGetSecretCalendarUrl, handleRegenerateSecretCalendarUrl,
    handleGetServicesForJob, handleAdminReassignJob, handleGetOpenInvoicesForUser,
    handleGetBlockedDates, handleAddBlockedDate, handleRemoveBlockedDate,
    handleAdminAddServiceToJob, handleAdminCompleteJob, handleAdminUpdateJobDetails,
    handleAdminUpdateServiceInJob, handleAdminDeleteServiceFromJob
} from './handlers/jobs.js';
import { handleGetUserPhotos, handleGetPhotosForJob } from './handlers/photos.js';
import { handleGetNotesForJob } from './handlers/notes.js';
import { handlePortalSession } from './handlers/user.js';
import { handleGetInvoiceForUser, handleCreatePaymentIntent, handleDownloadInvoicePdf } from './handlers/invoices.js';
import { handleRequestRecurrence, handleGetRecurrenceRequests, handleUpdateRecurrenceRequest, handleGetUnavailableRecurrenceDays } from './handlers/recurrence.js';


// --- Admin Handlers ---
import { handleGetAllUsers, handleAdminGetJobsForUser, handleAdminGetPhotosForUser, handleAdminDeleteUser, handleAdminCreateInvoice, handleGetAllJobs, handleGetAllServices, handleAdminCreateJobForUser, handleAdminCreateUser, handleAdminUpdateUser } from './handlers/admin/users.js';
import { handleAdminUploadPhotoForUser } from './handlers/photos.js';
import { handleAdminAddNoteForUser } from './handlers/notes.js';
import { handleAdminCreateQuote, handleAdminImportQuotes } from './handlers/admin/quotes.js';
import { handleAdminImportInvoices, handleAdminGetInvoice, handleAdminAddInvoiceItem, handleAdminDeleteInvoiceItem, handleAdminFinalizeInvoice, handleAdminImportInvoicesForUser, handleAdminGetAllOpenInvoices } from './handlers/admin/invoices.js';
import { handleGetJobsAndQuotes, handleAdminCreateJob, handleAdminCreateQuote as handleAdminCreateQuoteFromBilling } from './handlers/admin/billing.js';


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

customerApi.get('/profile', handleGetProfile);
customerApi.put('/profile', handleUpdateProfile);
customerApi.post('/profile/change-password', handleChangePassword);
customerApi.get('/services', handleListServices);
customerApi.get('/services/:id', handleGetService);
customerApi.get('/jobs', handleGetJobs);
customerApi.post('/jobs', handleCreateJob);
// --- FIX: Moved specific route before generic route ---
customerApi.get('/jobs/unavailable-recurrence-days', handleGetUnavailableRecurrenceDays);
customerApi.get('/jobs/:id', handleGetJobById);
customerApi.get('/jobs/:id/photos', handleGetPhotosForJob);
customerApi.get('/jobs/:id/notes', handleGetNotesForJob);
customerApi.get('/jobs/:jobId/services', handleGetServicesForJob);
customerApi.post('/portal', handlePortalSession);
customerApi.post('/logout', handleLogout);
customerApi.get('/calendar.ics', handleCalendarFeed);
customerApi.get('/photos', handleGetUserPhotos);
customerApi.get('/calendar/secret-url', handleGetSecretCalendarUrl);
customerApi.post('/calendar/regenerate-url', handleRegenerateSecretCalendarUrl);
customerApi.get('/profile/payment-methods', handleListPaymentMethods);
customerApi.post('/profile/setup-intent', handleCreateSetupIntent);
customerApi.get('/notifications', handleGetNotifications);
customerApi.post('/notifications/read-all', handleMarkAllNotificationsRead);
customerApi.get('/invoices/open', handleGetOpenInvoicesForUser);
customerApi.get('/invoices/:invoiceId', handleGetInvoiceForUser);
customerApi.post('/invoices/:invoiceId/create-payment-intent', handleCreatePaymentIntent);
customerApi.get('/invoices/:invoiceId/pdf', handleDownloadInvoicePdf);
customerApi.post('/jobs/:jobId/request-recurrence', handleRequestRecurrence);

customerApi.get('/chat', async (c) => {
    const user = c.get('user');
    const isAdmin = user.role === 'admin';

    // If an admin provides a specific userId (from the AdminChat tool), use that.
    // Otherwise, the chat room is for the logged-in user themselves (customer or admin).
    const targetUserId = isAdmin && c.req.query('userId')
        ? c.req.query('userId')
        : user.id.toString();

    if (!targetUserId) {
        // This safeguard prevents errors if the user ID can't be determined.
        return c.json({ error: "Could not determine user for chat" }, 400);
    }

    const durableObject = c.env.CUSTOMER_SUPPORT_CHAT.get(c.env.CUSTOMER_SUPPORT_CHAT.idFromName(targetUserId));
    return durableObject.fetch(c.req.raw);
});


customerApi.all('/sms/*', handleSmsProxy);
customerApi.all('/notifications/*', handleNotificationProxy);

/* ========================================================================
                         ADMIN API ROUTES (Admin-Only)
   ======================================================================== */

adminApi.get('/users', handleGetAllUsers);
adminApi.post('/users', handleAdminCreateUser);
adminApi.put('/users/:userId', handleAdminUpdateUser);
adminApi.post('/jobs/:jobId/quote', handleAdminCreateQuote);
adminApi.post('/quotes/import', handleAdminImportQuotes);
adminApi.get('/users/:userId/jobs', handleAdminGetJobsForUser);
adminApi.get('/users/:userId/photos', handleAdminGetPhotosForUser);
adminApi.post('/users/:userId/photos', handleAdminUploadPhotoForUser);
adminApi.post('/users/:userId/notes', handleAdminAddNoteForUser);
adminApi.delete('/users/:userId', handleAdminDeleteUser);
adminApi.post('/users/:userId/invoice', handleAdminCreateInvoice);
adminApi.get('/blocked-dates', handleGetBlockedDates);
adminApi.post('/blocked-dates', handleAddBlockedDate);
adminApi.delete('/blocked-dates/:date', handleRemoveBlockedDate);
adminApi.get('/jobs', handleGetAllJobs);
adminApi.post('/jobs/:jobId/complete', handleAdminCompleteJob);
adminApi.put('/jobs/:jobId/details', handleAdminUpdateJobDetails);
adminApi.post('/jobs/:jobId/services', handleAdminAddServiceToJob);
adminApi.put('/jobs/:jobId/services/:serviceId', handleAdminUpdateServiceInJob);
adminApi.delete('/jobs/:jobId/services/:serviceId', handleAdminDeleteServiceFromJob);
adminApi.get('/services', handleGetAllServices);
adminApi.post('/users/:userId/jobs', handleAdminCreateJobForUser);
adminApi.post('/invoices/import', handleAdminImportInvoices);
adminApi.post('/users/:userId/invoices/import', handleAdminImportInvoicesForUser);
adminApi.get('/invoices/open', handleAdminGetAllOpenInvoices);
adminApi.get('/invoices/:invoiceId', handleAdminGetInvoice);
adminApi.post('/invoices/:invoiceId/items', handleAdminAddInvoiceItem);
adminApi.delete('/invoices/:invoiceId/items/:itemId', handleAdminDeleteInvoiceItem);
adminApi.post('/invoices/:invoiceId/finalize', handleAdminFinalizeInvoice);
adminApi.post('/import-contacts', handleAdminImportSelectedContacts);
adminApi.post('/get-imported-contacts', handleGetImportedContacts);
adminApi.get('/billing/jobs-and-quotes', handleGetJobsAndQuotes);
adminApi.post('/jobs/:jobId/reassign', handleAdminReassignJob);
adminApi.post('/billing/job', handleAdminCreateJob);
adminApi.post('/billing/quote', handleAdminCreateQuoteFromBilling);
adminApi.get('/recurrence-requests', handleGetRecurrenceRequests);
adminApi.put('/recurrence-requests/:requestId', handleUpdateRecurrenceRequest);


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

export { CustomerSupportChat };
export default app;
