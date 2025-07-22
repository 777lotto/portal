// 777lotto/portal/portal-bet/frontend/src/lib/api.ts
import {
  type Job,
  type Service,
  type User,
  type AuthResponse,
  type PortalSession,
  type Conversation,
  type SMSMessage,
  type Photo,
  type Note,
  type PhotoWithNotes,
  type BlockedDate,
  type StripeInvoice,
  type UINotification,
  type JobWithDetails
} from "@portal/shared";
import { fetchJson } from './fetchJson.js';



/* ========================================================================
                              API HELPER FUNCTIONS
   ======================================================================== */

export const apiGet = <T>(path: string): Promise<T> => {
  return fetchJson<T>(path);
};

export const apiPost = <T>(path: string, body: unknown, method: "POST" | "PUT" = "POST"): Promise<T> => {
  return fetchJson<T>(path, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};

export const apiPostFormData = <T>(path: string, formData: FormData): Promise<T> => {
  return fetchJson<T>(path, {
    method: 'POST',
    body: formData,
  });
};


/* ========================================================================
                                  PUBLIC API
   ======================================================================== */

export const getPublicAvailability = () => apiGet<{ bookedDays: string[] }>('/api/public/availability');
export const createPublicBooking = (data: unknown) => apiPost('/api/public/booking', data);
export const checkUser = (identifier: string) => apiPost<{ status: string }>('/api/check-user', { identifier });
export const initializeSignup = (data: unknown) => apiPost<any>('/api/signup/initialize', data);
export const requestPasswordReset = (identifier: string, channel: 'email' | 'sms') => apiPost('/api/request-password-reset', { identifier, channel });
export const verifyResetCode = (identifier: string, code: string) => {
    return apiPost<{ passwordSetToken: string }>('/api/verify-reset-code', { identifier, code });
};
export const loginWithToken = (passwordSetToken: string) => {
  return fetchJson<AuthResponse>('/api/login-with-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${passwordSetToken}`
    },
  });
};
export const setPassword = (password: string, passwordSetToken: string) => {
  return fetchJson<AuthResponse>('/api/set-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${passwordSetToken}`
    },
    body: JSON.stringify({ password }),
  });
};


/* ========================================================================
                                  AUTH
   ======================================================================== */

export const login = (data: unknown) => apiPost<AuthResponse>('/api/login', data);
export const logout = () => apiPost('/api/logout', {});


/* ========================================================================
                                  USER & PROFILE
   ======================================================================== */

export const getProfile = () => apiGet<User>('/api/profile');
export const updateProfile = (data: Partial<User>) => apiPost<User>('/api/profile', data, 'PUT');
export const createPortalSession = () => apiPost<PortalSession>('/api/portal', {});
export const listPaymentMethods = () => apiGet<any[]>('/api/profile/payment-methods');
export const createSetupIntent = () => apiPost<{ clientSecret: string }>('/api/profile/setup-intent', {});


/* ========================================================================
                                  SERVICES
   ======================================================================== */

export const getServices = () => apiGet<Service[]>('/api/services');
export const getService = (id: string) => apiGet<Service>(`/api/services/${id}`);
export const createInvoice = (serviceId: string) => apiPost<any>(`/api/services/${serviceId}/invoice`, {});


/* ========================================================================
                                  JOBS
   ======================================================================== */

export const getJobs = () => apiGet<Job[]>('/api/jobs');
export const getJob = (id: string) => apiGet<Job>(`/api/jobs/${id}`);
export const getServicesForJob = (jobId: string) => apiGet<Service[]>(`/api/jobs/${jobId}/services`);
export const getOpenInvoices = () => apiGet<StripeInvoice[]>('/api/invoices/open');

/* ========================================================================
                                  ADMIN API
   ======================================================================== */

export const adminCreateUser = (data: unknown) => apiPost<User>('/api/admin/users', data);
export const adminUpdateUser = (userId: string, data: Partial<User>) => apiPost<User>(`/api/admin/users/${userId}`, data, 'PUT');
export const deleteUser = (userId: string) => fetchJson(`/api/admin/users/${userId}`, { method: 'DELETE' });
export const getBlockedDates = () => apiGet<BlockedDate[]>('/api/admin/blocked-dates');
export const addBlockedDate = (date: string, reason?: string) => apiPost('/api/admin/blocked-dates', { date, reason });
export const removeBlockedDate = (date: string) => fetchJson(`/api/admin/blocked-dates/${date}`, { method: 'DELETE' });
export const adminCreateInvoice = (userId: string) => apiPost<{ invoice: StripeInvoice }>(`/api/admin/users/${userId}/invoice`, {});
export const adminGetAllJobs = () => apiGet<Job[]>('/api/admin/jobs');
export const adminGetAllServices = () => apiGet<Service[]>('/api/admin/services');
export const adminCreateJobForUser = (userId: string, data: { title: string; start: string; price_cents: number }) => {
  return apiPost<Job>(`/api/admin/users/${userId}/jobs`, data);
};
export const adminGetAllOpenInvoices = () => apiGet<StripeInvoice[]>('/api/admin/invoices/open');
export const adminFinalizeJob = (jobId: string) => {
  return apiPost<{ invoiceId: string; invoiceUrl: string | null }>(`/api/admin/jobs/${jobId}/complete`, {});
};
export const adminImportInvoices = () => apiPost<{ message: string, imported: number, skipped: number, errors: string[] }>('/api/admin/invoices/import', {});
export const adminImportQuotes = () => apiPost<{ message: string, imported: number, skipped: number, errors: string[] }>('/api/admin/quotes/import', {});
export const adminImportInvoicesForUser = (userId: string) => apiPost<{ message: string, imported: number, skipped: number, errors: string[] }>(`/api/admin/users/${userId}/invoices/import`, {});
export const getImportedContacts = (token: string) => apiPost<any[]>('/api/admin/get-imported-contacts', { token });
export const adminGetJobsAndQuotes = () => apiGet<JobWithDetails[]>('/api/admin/billing/jobs-and-quotes');
export const adminReassignJob = (jobId: string, newCustomerId: string) => {
  return apiPost(`/api/admin/jobs/${jobId}/reassign`, { newCustomerId });
};
export const adminCreateJob = (data: any) => apiPost('/api/admin/billing/job', data);
export const adminCreateQuote = (data: any) => apiPost('/api/admin/billing/quote', data);


/* ========================================================================
                            ADMIN INVOICE FUNCTIONS
   ======================================================================== */

export const getInvoice = (invoiceId: string) => apiGet<StripeInvoice>(`/api/admin/invoices/${invoiceId}`);

export const addInvoiceItem = (invoiceId: string, data: { description: string, amount: number }) => {
  return apiPost(`/api/admin/invoices/${invoiceId}/items`, data);
};

export const deleteInvoiceItem = (invoiceId: string, itemId: string) => {
  return fetchJson(`/api/admin/invoices/${invoiceId}/items/${itemId}`, { method: 'DELETE' });
};

export const finalizeInvoice = (invoiceId: string) => {
  return apiPost<StripeInvoice>(`/api/admin/invoices/${invoiceId}/finalize`, {});
};


/* ========================================================================
                                PHOTOS & NOTES
   ======================================================================== */

export const getPhotos = (filters: { [key: string]: string } = {}) => {
  const query = new URLSearchParams(filters).toString();
  return apiGet<PhotoWithNotes[]>(`/api/photos?${query}`);
};
export const getPhotosForJob = (jobId: string) => apiGet<Photo[]>(`/api/jobs/${jobId}/photos`);
export const getNotesForJob = (jobId: string) => apiGet<Note[]>(`/api/jobs/${jobId}/notes`);


/* ========================================================================
                                    SMS
   ======================================================================== */

export const getSmsConversations = () => apiGet<Conversation[]>('/api/sms/conversations');
export const getSmsConversation = (phoneNumber: string) => apiGet<SMSMessage[]>(`/api/sms/conversation/${phoneNumber}`);
export const sendSms = (phoneNumber: string, message: string) => apiPost<SMSMessage>('/api/sms/send', { to: phoneNumber, message });


/* ========================================================================
                                  CALENDAR
   ======================================================================== */

export const downloadCalendarFeed = () => apiGet<string>('/api/calendar.ics');
export const getSecretCalendarUrl = () => apiGet<{url: string}>('/api/calendar/secret-url');
export const regenerateSecretCalendarUrl = () => apiPost<{url: string}>('/api/calendar/regenerate-url', {});
export const syncCalendar = (url: string) => apiPost('/api/calendar-sync', { url });


/* ========================================================================
                             PUSH NOTIFICATIONS
   ======================================================================== */

export const getVapidKey = () => apiGet<string>('/api/notifications/vapid-key');
export const subscribeToPush = (subscription: any) => apiPost('/api/notifications/subscribe', subscription);


/* ========================================================================
                             UI NOTIFICATIONS
   ======================================================================== */

export const getNotifications = () => apiGet<UINotification[]>('/api/notifications');
export const markAllNotificationsRead = () => apiPost('/api/notifications/read-all', {});
