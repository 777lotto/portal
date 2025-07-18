// 777lotto/portal/portal-bet/worker/src/index.ts
/* ========================================================================
                        IMPORTS & INITIALIZATION
   ======================================================================== */

import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import manifest from '__STATIC_CONTENT_MANIFEST';
import type { Env, User } from '@portal/shared';
import { handleGoogleLogin, handleGoogleCallback } from './handlers/google.js';

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
import { handleGetJobs, handleGetJobById, handleCalendarFeed, handleCreateJob, handleGetSecretCalendarUrl, handleRegenerateSecretCalendarUrl } from './handlers/jobs.js';
import { handleGetUserPhotos, handleGetPhotosForJob } from './handlers/photos.js';
import { handleGetNotesForJob } from './handlers/notes.js';
import { handlePortalSession } from './handlers/user.js';

// --- Admin Handlers ---
import { handleGetAllUsers, handleAdminGetJobsForUser, handleAdminGetPhotosForUser, handleAdminDeleteUser, handleAdminCreateInvoice, handleGetAllJobs, handleGetAllServices, handleAdminCreateJobForUser, handleAdminCreateUser, handleAdminUpdateUser } from './handlers/admin/users.js';
import { handleAdminUploadPhotoForUser } from './handlers/photos.js';
import { handleAdminAddNoteForUser } from './handlers/notes.js';
import { handleGetBlockedDates, handleAddBlockedDate, handleRemoveBlockedDate, handleAdminAddServiceToJob, handleAdminCompleteJob } from './handlers/jobs.js';
import { handleAdminCreateQuote } from './handlers/admin/quotes.js';
import { handleAdminImportInvoices, handleAdminGetInvoice, handleAdminAddInvoiceItem, handleAdminDeleteInvoiceItem, handleAdminFinalizeInvoice, handleAdminImportInvoicesForUser } from './handlers/admin/invoices.js';


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
    const chatService = c.env.CHAT_SERVICE;
    if (!chatService) {
        return c.json({ error: "Chat service is unavailable" }, 503);
    }
    const newRequest = new Request(c.req.url, c.req.raw);
    const user = c.get('user');
    newRequest.headers.set('X-Internal-User-Id', user.id.toString());
    newRequest.headers.set('X-Internal-User-Name', user.name); // <-- FIX IS HERE
    newRequest.headers.set('X-Internal-User-Role', user.role);
    return await chatService.fetch(newRequest);
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
// customerApi.post('/services/:id/invoice', handleCreateInvoice); // DEPRECATED
customerApi.get('/jobs', handleGetJobs);
customerApi.post('/jobs', handleCreateJob);
customerApi.get('/jobs/:id', handleGetJobById);
customerApi.get('/jobs/:id/photos', handleGetPhotosForJob);
customerApi.get('/jobs/:id/notes', handleGetNotesForJob);
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


// --- Proxied Routes ---
customerApi.all('/sms/*', handleSmsProxy);
customerApi.all('/notifications/*', handleNotificationProxy);
customerApi.all('/chat/*', requireAuthMiddleware, handleChatProxy);

/* ========================================================================
                         ADMIN API ROUTES (Admin-Only)
   ======================================================================== */

adminApi.get('/users', handleGetAllUsers);
adminApi.post('/users', handleAdminCreateUser);
adminApi.put('/users/:userId', handleAdminUpdateUser);
adminApi.post('/jobs/:jobId/quote', handleAdminCreateQuote);
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
adminApi.get('/services', handleGetAllServices);
adminApi.post('/users/:userId/jobs', handleAdminCreateJobForUser);
adminApi.post('/jobs/:jobId/complete', handleAdminCompleteJob);
adminApi.post('/jobs/:jobId/services', handleAdminAddServiceToJob);
adminApi.post('/invoices/import', handleAdminImportInvoices);
adminApi.post('/users/:userId/invoices/import', handleAdminImportInvoicesForUser);
adminApi.get('/invoices/:invoiceId', handleAdminGetInvoice);
adminApi.post('/invoices/:invoiceId/items', handleAdminAddInvoiceItem);
adminApi.delete('/invoices/:invoiceId/items/:itemId', handleAdminDeleteInvoiceItem);
adminApi.post('/invoices/:invoiceId/finalize', handleAdminFinalizeInvoice);


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

app.get('/*', serveStatic({
    root: './',
    manifest,
}));

app.get('*', serveStatic({
    path: './index.html',
    manifest,
}));


/* ========================================================================
                                   EXPORT
   ======================================================================== */

export default app;
