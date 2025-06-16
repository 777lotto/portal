// frontend/src/lib/api.ts - Fixed with proper types
import { fetchJson } from "./fetchJson";
import { Job, Service, User, AuthResponse, PortalSession, Conversation, SMSMessage } from '@portal/shared';

/* ---------- low-level helpers ---------- */

// Make the helpers generic to pass types through to fetchJson
export const apiGet = <T>(path: string, token?: string) =>
  fetchJson<T>(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

export const apiPost = <T>(
  path: string,
  body: unknown,
  token?: string,
  method: "POST" | "PUT" | "DELETE" = "POST",
) =>
  fetchJson<T>(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

/* ---------- auth ---------- */

// Specify the expected response types for each endpoint
export const checkStripeCustomer = (email: string, phone: string) =>
  apiPost<{ exists: boolean; name?: string; email?: string; }>("/stripe/check-customer", { email, phone });

export const createStripeCustomer = (email: string, name: string, phone: string) =>
  apiPost<{ success: boolean; customerId: string; }>("/stripe/create-customer", { email, name, phone });

export const login = (identifier: string, password: string, turnstileToken?: string) =>
  apiPost<AuthResponse>("/login", { identifier, password, turnstileToken });

export const signup = (email: string, name: string, password: string, phone: string) =>
  apiPost<AuthResponse>("/signup", { email, name, password, phone });

export const signupCheck = (email: string, phone: string, turnstileToken?: string) =>
  apiPost<{ status: string; }>("/signup/check", { email, phone, turnstileToken });


/* ---------- services ---------- */

export const getServices = (token: string) =>
  apiGet<Service[]>("/services", token);

export const getService = (id: number, token: string) =>
  apiGet<Service>(`/services/${id}`, token);


/* ---------- jobs ---------- */

export const getJobs = (token: string) =>
  apiGet<Job[]>("/jobs", token);

export const getJob = (id: string, token: string) =>
  apiGet<Job>(`/jobs/${id}`, token);


/* ---------- profile ---------- */

export const getProfile = (token: string) =>
  apiGet<User>("/profile", token);

export const updateProfile = (profileData: Record<string, unknown>, token: string) =>
  apiPost<User>("/profile", profileData, token, "PUT");


/* ---------- invoices ---------- */

export const getInvoice = (serviceId: number, token: string) =>
  apiGet<{ hosted_invoice_url: string }>("/services/${serviceId}/invoice", token);


/* ---------- Stripe Customer Portal ---------- */

export const openPortal = (token: string) =>
  apiPost<PortalSession>("/portal", {}, token);

/* ---------- Calendar Integration ---------- */

export const getCalendarFeed = (token: string) =>
  `${window.location.origin}/api/calendar-feed?token=${token}`;

export const syncCalendar = (calendarUrl: string, token: string) =>
  apiPost("/calendar-sync", { calendarUrl }, token);

/* ---------- Worker Service Binding ---------- */

export const callWorkerService = (serviceName: string, path: string, data?: Record<string, unknown>, token?: string) =>
  apiPost(`/worker-service/${serviceName}${path}`, data || {}, token);

// Helper functions for specific worker services

export const callNotificationService = (action: string, data: Record<string, unknown>, token: string) =>
  callWorkerService('notification', `/${action}`, data, token);

export const callPaymentProcessingService = (action: string, data: Record<string, unknown>, token: string) =>
  callWorkerService('payment', `/${action}`, data, token);

export const callSchedulingService = (action: string, data: Record<string, unknown>, token: string) =>
  callWorkerService('scheduling', `/${action}`, data, token);

// Specific notification functions
export const sendEmailNotification = (emailData: {
  to: string;
  subject: string;
  body: string;
  templateId?: string;
}, token: string) =>
  callNotificationService('send-email', emailData, token);

export const sendSmsNotification = (smsData: {
  to: string;
  message: string;
}, token: string) =>
  callNotificationService('send-sms', smsData, token);

// Specific payment processing functions
export const processPayment = (paymentData: {
  amount: number;
  currency: string;
  description: string;
  customerId: string;
}, token: string) =>
  callPaymentProcessingService('process', paymentData, token);

export const refundPayment = (refundData: {
  paymentId: string;
  amount?: number;
}, token: string) =>
  callPaymentProcessingService('refund', refundData, token);

// Specific scheduling functions
export const checkAvailability = (date: string, token: string) =>
  callSchedulingService('check-availability', { date }, token);

export const scheduleJob = (jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>, token: string) =>
  callSchedulingService('schedule', jobData, token);

export const rescheduleJob = (id: string, newDate: string, token: string) =>
  callSchedulingService('reschedule', { id, newDate }, token);

/* ---------- SMS ---------- */

export const getConversations = (token: string) =>
  apiGet<Conversation[]>("/sms/conversations", token);

export const getConversation = (phoneNumber: string, token: string) =>
  apiGet<SMSMessage[]>(`/sms/messages/${phoneNumber}`, token);

export const sendSMS = (to: string, message: string, token: string) =>
  apiPost("/sms/send", { to, message }, token);

/* ---------- Payment Reminders ---------- */

export const sendPaymentReminder = (serviceId: number, token: string) =>
  apiPost(`/payment/send-reminder`, { serviceId }, token);

export const runPaymentReminders = (token: string) =>
  apiPost("/payment/run-reminders", {}, token);
