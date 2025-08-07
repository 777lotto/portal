import {
  type Job,
  type LineItem,
  type User,
  type AuthResponse,
  type PortalSession,
  type Conversation,
  type SMSMessage,
  type Photo,
  type Note,
  type CalendarEvent,
  type StripeInvoice,
  type UINotification,
  type JobWithDetails,
  type JobRecurrenceRequest,
  type LoginPayload,
  type LoginResponse,
  type VerifyCodePayload,
  type VerifyCodeResponse,
  type RequestPasswordResetPayload,
  type SetPasswordPayload,
  type BookingPayload,
  type QuoteProposalPayload,
  type Notification,
  type Recurrence,
  type RecurrenceRequestPayload,
} from "@portal/shared";
import { fetchJson } from './fetchJson.js';

const API_BASE_URL = '/api';

/* ========================================================================
                              API HELPER FUNCTIONS
   ======================================================================== */

export const apiGet = <T>(path: string): Promise<T> => {
  return fetchJson<T>(`${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`);
};

export const apiPost = <T>(path: string, body: unknown, method: "POST" | "PUT" = "POST"): Promise<T> => {
  const url = `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  return fetchJson<T>(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};

export const apiPostFormData = <T>(path: string, formData: FormData): Promise<T> => {
  const url = `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  return fetchJson<T>(url, {
    method: 'POST',
    body: formData,
  });
};

/* ========================================================================
                                  PUBLIC API
   ======================================================================== */

export const getPublicAvailability = () => apiGet<{ bookedDays: string[] }>('/public/availability');
export const createPublicBooking = (data: unknown) => apiPost('/public/booking', data);
export const checkUser = (identifier: string) => apiPost<{ status: string }>('/check-user', { identifier });
export const initializeSignup = (data: unknown) => apiPost<any>('/signup/initialize', data);
export const verifyResetCode = (identifier: string, code: string) => apiPost<{ passwordSetToken: string }>('/verify-reset-code', { identifier, code });
export const loginWithToken = (passwordSetToken: string) => {
  return fetchJson<AuthResponse>('/api/login-with-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${passwordSetToken}`
    },
  });
};

/* ========================================================================
                                  AUTH
   ======================================================================== */

export const login = (payload: LoginPayload): Promise<LoginResponse> => fetchJson(`${API_BASE_URL}/login`, 'POST', payload);
export const logout = (): Promise<void> => fetchJson(`${API_BASE_URL}/logout`, 'POST');
export const verifyCode = (payload: VerifyCodePayload): Promise<VerifyCodeResponse> => fetchJson(`${API_BASE_URL}/verify`, 'POST', payload);
export const requestPasswordReset = (payload: RequestPasswordResetPayload): Promise<void> => fetchJson(`${API_BASE_URL}/request-password-reset`, 'POST', payload);
export const setPassword = (payload: SetPasswordPayload): Promise<void> => fetchJson(`${API_BASE_URL}/set-password`, 'POST', payload);

/* ========================================================================
                                  USER & PROFILE
   ======================================================================== */

export const getProfile = () => apiGet<User>('/profile');
export const updateProfile = (data: Partial<User>) => apiPost<User>('/profile', data, 'PUT');
export const createPortalSession = () => apiPost<PortalSession>('/portal', {});
export const listPaymentMethods = () => apiGet<any[]>('/profile/payment-methods');
export const createSetupIntent = () => apiPost<{ clientSecret: string }>('/profile/setup-intent', {});

/* ========================================================================
                                  JOBS & SERVICES
   ======================================================================== */

export const getJobs = () => apiGet<Job[]>('/jobs');
export const getJob = (id: string): Promise<JobWithDetails> => apiGet<JobWithDetails>(`/jobs/${id}`);
export const getLineItems = () => apiGet<LineItem[]>('/line-items');
export const getLineItem = (id: string) => apiGet<LineItem>(`/line-items/${id}`);
export const getLineItemsForJob = (jobId: string) => apiGet<LineItem[]>(`/jobs/${jobId}/line-items`);
export const createJob = (data: { title: string; lineItems: { id: number; description: string; quantity: number, unit_total_amount_cents: number }[] }) => apiPost<Job>('/jobs', data);

/* ========================================================================
                                  BOOKING & CALENDAR
   ======================================================================== */
export const getCustomerAvailability = () => apiGet<{ bookedDays: string[], pendingDays: string[], blockedDates: string[] }>('/availability');
export const createBooking = (payload: BookingPayload): Promise<Job> => fetchJson(`${API_BASE_URL}/book`, 'POST', payload);
export const downloadCalendarFeed = () => apiGet<string>('/calendar.ics');
export const getSecretCalendarUrl = () => apiGet<{url: string}>('/calendar/secret-url');
export const regenerateSecretCalendarUrl = () => apiPost<{url: string}>('/calendar/regenerate-url', {});
export const syncCalendar = (url: string) => apiPost('/calendar-sync', { url });

/* ========================================================================
                                  QUOTES & INVOICES
   ======================================================================== */

export const getOpenInvoices = () => apiGet<StripeInvoice[]>('/invoices/open');
export const getInvoiceDetails = (invoiceId: string): Promise<any> => fetchJson(`${API_BASE_URL}/invoices/${invoiceId}`);
export const getPendingQuotes = () => apiGet<Job[]>('/quotes/pending');
export const getQuote = (quoteId: string): Promise<JobWithDetails> => apiGet<JobWithDetails>(`/quotes/${quoteId}`);
export const getQuoteProposal = (jobId: string): Promise<QuoteProposalPayload> => fetchJson(`${API_BASE_URL}/quotes/${jobId}`);
export const acceptQuote = (quoteId: string): Promise<{ message: string }> => apiPost(`/quotes/${quoteId}/accept`, {});
export const declineQuote = (quoteId: string) => apiPost(`/quotes/${quoteId}/decline`, {});
export const reviseQuote = (quoteId: string, revisionReason: string) => apiPost(`/quotes/${quoteId}/revise`, { revisionReason });

/* ========================================================================
                                PHOTOS & NOTES
   ======================================================================== */

export const getPhotos = (jobId: string): Promise<Photo[]> => apiGet<Photo[]>(`/jobs/${jobId}/photos`);
export const addPhoto = (jobId: string, data: FormData): Promise<Photo> => fetchJson(`${API_BASE_URL}/jobs/${jobId}/photos`, 'POST', data, true);
export const getNotesForJob = (jobId: string) => apiGet<Note[]>(`/jobs/${jobId}/notes`);

/* ========================================================================
                                  RECURRENCE
   ======================================================================== */
export const getRecurrence = (jobId: string): Promise<Recurrence> => fetchJson(`${API_BASE_URL}/jobs/${jobId}/recurrence`);
export const createRecurrenceRequest = (jobId: string, payload: RecurrenceRequestPayload): Promise<void> => fetchJson(`${API_BASE_URL}/jobs/${jobId}/request-recurrence`, 'POST', payload);
export const getUnavailableRecurrenceDays = () => apiGet<{ unavailableDays: number[] }>('/jobs/unavailable-recurrence-days');

/* ========================================================================
                                  COMMUNICATIONS
   ======================================================================== */

export const getSmsConversations = () => apiGet<Conversation[]>('/sms/conversations');
export const getSmsConversation = (phoneNumber: string) => apiGet<SMSMessage[]>(`/sms/conversation/${phoneNumber}`);
export const sendSms = (phoneNumber: string, message: string) => apiPost<SMSMessage>('/sms/send', { to: phoneNumber, message });
export const getVapidKey = () => apiGet<string>('/notifications/vapid-key');
export const subscribeToPush = (subscription: any) => apiPost('/notifications/subscribe', subscription);
export const getNotifications = () => apiGet<(UINotification | Notification)[]>('/notifications');
export const markAllNotificationsRead = () => apiPost('/notifications/read-all', {});

/* ========================================================================
                                  ADMIN API
   ======================================================================== */

export const adminGetUsers = (): Promise<User[]> => fetchJson(`${API_BASE_URL}/admin/users`);
export const adminCreateUser = (data: unknown) => apiPost<User>('/admin/users', data);
export const adminGetUser = (userId: string): Promise<User> => fetchJson(`${API_BASE_URL}/admin/users/${userId}`);
export const adminUpdateUser = (user_id: string, data: Partial<User>) => apiPost<User>(`/admin/users/${user_id}`, data, 'PUT');
export const adminDeleteUser = (user_id: string) => fetchJson(`${API_BASE_URL}/admin/users/${user_id}`, { method: 'DELETE' });
export const adminGetUserJobs = (userId: string): Promise<Job[]> => fetchJson(`${API_BASE_URL}/admin/users/${userId}/jobs`);
export const adminGetUserPhotos = (userId: string): Promise<Photo[]> => fetchJson(`${API_BASE_URL}/admin/users/${userId}/photos`);
export const adminGetUserNotes = (userId: string): Promise<Note[]> => fetchJson(`${API_BASE_URL}/admin/users/${userId}/notes`);
export const adminAddUserNote = (userId: string, content: string): Promise<Note> => fetchJson(`${API_BASE_URL}/admin/users/${userId}/notes`, 'POST', { content });

export const adminGetJobsAndQuotes = (): Promise<JobWithDetails[]> => fetchJson(`${API_BASE_URL}/admin/jobs`);
export const adminGetJob = (jobId: string): Promise<JobWithDetails> => fetchJson(`${API_BASE_URL}/admin/jobs/${jobId}`);
export const adminUpdateJob = (jobId: string, payload: Partial<Job>): Promise<Job> => fetchJson(`${API_BASE_URL}/admin/jobs/${jobId}`, 'PUT', payload);
export const adminCreateJob = (payload: Partial<Job>): Promise<Job> => fetchJson(`${API_BASE_URL}/admin/jobs`, 'POST', payload);
export const adminCreateQuote = (jobId: string, payload: any): Promise<any> => fetchJson(`${API_BASE_URL}/admin/jobs/${jobId}/quote`, 'POST', payload);
export const adminSendInvoice = (jobId: string): Promise<any> => fetchJson(`${API_BASE_URL}/admin/jobs/${jobId}/invoice`, 'POST');
export const adminFinalizeJob = (jobId: string) => apiPost<{ invoiceId: string; invoiceUrl: string | null }>(`/admin/jobs/${jobId}/complete`, {});
export const adminReassignJob = (jobId: string, newuser_id: string) => apiPost(`/admin/jobs/${jobId}/reassign`, { newuser_id });
export const adminUpdateJobDetails = (jobId: string, data: Partial<Job>) => apiPost(`/admin/jobs/${jobId}/details`, data, 'PUT');
export const adminAddLineItemToJob = (jobId: string, data: Partial<LineItem>) => apiPost(`/admin/jobs/${jobId}/line-items`, data);
export const adminUpdateLineItemInJob = (jobId: string, lineItemId: number, data: Partial<LineItem>) => apiPost(`/admin/jobs/${jobId}/line-items/${lineItemId}`, data, 'PUT');
export const adminDeleteLineItemFromJob = (jobId: string, lineItemId: number) => apiPost(`/admin/jobs/${jobId}/line-items/${lineItemId}`, {}, 'DELETE');

export const adminGetAllJobs = () => apiGet<Job[]>('/admin/jobs');
export const adminGetAllLineItems = () => apiGet<LineItem[]>('/admin/line-items');
export const adminGetAllOpenInvoices = () => apiGet<StripeInvoice[]>('/admin/invoices/open');
export const adminGetInvoice = (invoiceId: string) => apiGet<StripeInvoice>(`/admin/invoices/${invoiceId}`);
export const adminAddInvoiceItem = (invoiceId: string, data: { description: string, amount: number }) => apiPost(`/admin/invoices/${invoiceId}/items`, data);
export const adminDeleteInvoiceItem = (invoiceId: string, itemId: string) => fetchJson(`${API_BASE_URL}/admin/invoices/${invoiceId}/items/${itemId}`, { method: 'DELETE' });
export const adminFinalizeInvoice = (invoiceId: string) => apiPost<StripeInvoice>(`/admin/invoices/${invoiceId}/finalize`, {});
export const adminMarkInvoiceAsPaid = (invoiceId: string) => apiPost<StripeInvoice>(`/admin/invoices/${invoiceId}/mark-as-paid`, {});

export const adminGetCalendarEvents = () => apiGet<CalendarEvent[]>('/admin/calendar-events');
export const adminAddCalendarEvent = (event: Omit<CalendarEvent, 'id' | 'user_id'>) => apiPost('/admin/calendar-events', event);
export const adminRemoveCalendarEvent = (eventId: number) => fetchJson(`${API_BASE_URL}/admin/calendar-events/${eventId}`, { method: 'DELETE' });

export const adminGetRecurrenceRequests = (): Promise<JobRecurrenceRequest[]> => apiGet('/admin/recurrence-requests');
export const adminUpdateRecurrenceRequest = (requestId: number, data: { status: 'accepted' | 'declined' | 'countered', admin_notes?: string, frequency?: number, requested_day?: number }) => apiPost(`/admin/recurrence-requests/${requestId}`, data, 'PUT');
export const adminGetDrafts = () => apiGet<any[]>('/admin/drafts');

export const adminImportInvoices = () => apiPost<{ message: string, imported: number, skipped: number, errors: string[] }>('/admin/invoices/import', {});
export const adminImportQuotes = () => apiPost<{ message: string, imported: number, skipped: number, errors: string[] }>('/admin/quotes/import', {});
export const adminImportInvoicesForUser = (user_id: string) => apiPost<{ message: string, imported: number, skipped: number, errors: string[] }>(`/admin/users/${user_id}/invoices/import`, {});
export const getImportedContacts = (token: string) => apiPost<any[]>('/admin/get-imported-contacts', { token });
