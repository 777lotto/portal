// worker/src/index.ts - MODIFIED

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import manifest from '__STATIC_CONTENT_MANIFEST';

import { errorResponse } from './utils.js';
import { requireAuthMiddleware, requireAdminAuthMiddleware, requirePasswordSetTokenMiddleware } from './auth.js';
import { handleSignup, handleLogin, handleRequestPasswordReset, handleLogout, handleSetPassword, handleCheckUser, handleVerifyResetCode, handleLoginWithToken } from './handlers/auth.js';
// MODIFIED: Import handleChangePassword
import { handleGetProfile, handleUpdateProfile, handleChangePassword } from './handlers/profile.js';
import { handleStripeWebhook } from './handlers/stripe.js';
import { handleListServices, handleGetService, handleCreateInvoice, handleGetPhotosForService, handleGetNotesForService } from './handlers/services.js';
import { handleGetJobs, handleGetJobById, handleCalendarFeed, handleCreateJob, handleGetBlockedDates, handleAddBlockedDate, handleRemoveBlockedDate, handleGetSecretCalendarUrl, handleRegenerateSecretCalendarUrl } from './handlers/jobs.js';
import { handleGetAllUsers, handleAdminGetJobsForUser, handleAdminGetPhotosForUser, handleAdminDeleteUser } from './handlers/admin/users.js';
import { handleGetUserPhotos, handleGetPhotosForJob, handleAdminUploadPhotoForUser } from './handlers/photos.js';
import { handleGetNotesForJob, handleAdminAddNoteForUser } from './handlers/notes.js';
import { handlePortalSession } from './handlers/user.js';
import { handleSmsProxy } from './sms.js';
import { handleGetAvailability, handleCreateBooking, handlePublicCalendarFeed } from './handlers/public.js';
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
// ... (rest of public routes are unchanged)
publicApi.post('/check-user', handleCheckUser);
publicApi.post('/request-password-reset', handleRequestPasswordReset);
publicApi.post('/verify-reset-code', handleVerifyResetCode);
publicApi.post('/login-with-token', requirePasswordSetTokenMiddleware, handleLoginWithToken);
publicApi.post('/set-password', requirePasswordSetTokenMiddleware, handleSetPassword);
publicApi.post('/stripe/webhook', handleStripeWebhook);
publicApi.get('/public/availability', handleGetAvailability);
publicApi.post('/public/booking', handleCreateBooking);
publicApi.get('/public/calendar/feed/:token', handlePublicCalendarFeed);

/* --- Customer API Routes (Authenticated) --- */
customerApi.get('/profile', handleGetProfile);
customerApi.put('/profile', handleUpdateProfile);
customerApi.post('/profile/change-password', handleChangePassword); // ADDED
// ... (rest of customer routes are unchanged)
customerApi.get('/services', handleListServices);
customerApi.get('/services/:id', handleGetService);
customerApi.post('/services/:id/invoice', handleCreateInvoice);
customerApi.get('/services/:id/photos', handleGetPhotosForService);
customerApi.get('/services/:id/notes', handleGetNotesForService);
customerApi.get('/jobs', handleGetJobs);
customerApi.post('/jobs', handleCreateJob);
customerApi.get('/jobs/:id', handleGetJobById);
customerApi.get('/jobs/:id/photos', handleGetPhotosForJob);
customerApi.get('/jobs/:id/notes', handleGetNotesForJob);
customerApi.post('/portal', handlePortalSession);
customerApi.all('/sms/*', handleSmsProxy);
customerApi.post('/logout', handleLogout);
customerApi.get('/calendar.ics', handleCalendarFeed);
customerApi.get('/photos', handleGetUserPhotos);
customerApi.get('/calendar/secret-url', handleGetSecretCalendarUrl);
customerApi.post('/calendar/regenerate-url', handleRegenerateSecretCalendarUrl);


/* --- Admin API Routes (Admin-Only) --- */
// ... (admin routes are unchanged)
adminApi.get('/users', handleGetAllUsers);
adminApi.get('/users/:userId/jobs', handleAdminGetJobsForUser);
adminApi.get('/users/:userId/photos', handleAdminGetPhotosForUser);
adminApi.post('/users/:userId/photos', handleAdminUploadPhotoForUser);
adminApi.post('/users/:userId/notes', handleAdminAddNoteForUser);
adminApi.get('/blocked-dates', handleGetBlockedDates);
adminApi.post('/blocked-dates', handleAddBlockedDate);
adminApi.delete('/users/:userId', handleAdminDeleteUser);
adminApi.delete('/blocked-dates/:date', handleRemoveBlockedDate);

api.route('/', publicApi);
api.route('/', customerApi);
api.route('/admin', adminApi);

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
