// src/lib/api.ts
import { fetchJson } from "./fetchJson";
import { Job } from '@portal/shared';

/* ---------- low‑level helpers ---------- */

export const apiGet = (path: string, token?: string) =>
  fetchJson(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

export const apiPost = (
  path: string,
  body: unknown,
  token?: string,
  method: "POST" | "PUT" | "DELETE" = "POST",
) =>
  fetchJson(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

/* ---------- auth ---------- */

export const checkStripeCustomer = (email: string, phone: string) =>
  apiPost("/stripe/check-customer", { email, phone });

export const createStripeCustomer = (email: string, name: string, phone: string) =>
  apiPost("/stripe/create-customer", { email, name, phone });

export const requestPasswordReset = (email: string, turnstileToken?: string) =>
  apiPost("/password-reset/request", { email, turnstileToken });

export const completePasswordReset = (token: string, newPassword: string) =>
  apiPost("/password-reset/complete", { token, newPassword });

export const login = (identifier: string, password: string, turnstileToken?: string) =>
  apiPost("/login", { identifier, password, turnstileToken });

export const signup = (email: string, name: string, password: string, phone: string) =>
  apiPost("/signup", { email, name, password, phone });

export const signupCheck = (email: string, phone: string, turnstileToken?: string) =>
  apiPost("/signup/check", { email, phone, turnstileToken });

/* ---------- services ---------- */

export const getServices = (token: string) =>
  apiGet("/services", token);

export const getService = (id: number, token: string) =>
  apiGet(`/services/${id}`, token);

export const createService = (serviceData: any, token: string) =>
  apiPost("/services", serviceData, token);

export const updateService = (id: number, serviceData: any, token: string) =>
  apiPost(`/services/${id}`, serviceData, token, "PUT");

export const deleteService = (id: number, token: string) =>
  apiPost(`/services/${id}`, {}, token, "DELETE");

/* ---------- jobs ---------- */

export const getJobs = (token: string) =>
  apiGet("/jobs", token);

export const getJob = (id: string, token: string) =>
  apiGet(`/jobs/${id}`, token);

export const createJob = (job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>, token: string) =>
  apiPost("/jobs", job, token);

export const updateJob = (id: string, job: Partial<Job>, token: string) =>
  apiPost(`/jobs/${id}`, job, token, "PUT");

export const deleteJob = (id: string, token: string) =>
  apiPost(`/jobs/${id}`, {}, token, "DELETE");

/* ---------- profile ---------- */

export const getProfile = (token: string) =>
  apiGet("/profile", token);

export const updateProfile = (profileData: any, token: string) =>
  apiPost("/profile", profileData, token, "PUT");

/* ---------- invoices ---------- */

export const getInvoice = (serviceId: number, token: string) =>
  apiGet(`/services/${serviceId}/invoice`, token);

export const createInvoice = (serviceId: number, invoiceData: any, token: string) =>
  apiPost(`/services/${serviceId}/invoice`, invoiceData, token);

/* ---------- Stripe Customer Portal ---------- */

export const openPortal = (token: string) =>
  apiPost("/portal", {}, token);

/* ---------- Calendar Integration ---------- */

export const getCalendarFeed = (token: string) =>
  `${window.location.origin}/api/calendar-feed?token=${token}`;

export const syncCalendar = (calendarUrl: string, token: string) =>
  apiPost("/calendar-sync", { calendarUrl }, token);

/* ---------- Worker Service Binding ---------- */

export const callWorkerService = (serviceName: string, path: string, data?: any, token?: string) =>
  apiPost(`/worker-service/${serviceName}${path}`, data || {}, token);

// Helper functions for specific worker services

export const callNotificationService = (action: string, data: any, token: string) =>
  callWorkerService('notification', `/${action}`, data, token);

export const callPaymentProcessingService = (action: string, data: any, token: string) =>
  callWorkerService('payment', `/${action}`, data, token);

export const callSchedulingService = (action: string, data: any, token: string) =>
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
  apiGet("/sms/conversations", token);

export const getConversation = (phoneNumber: string, token: string) =>
  apiGet(`/sms/messages/${phoneNumber}`, token);

export const sendSMS = (to: string, message: string, token: string) =>
  apiPost("/sms/send", { to, message }, token);

/* ---------- Payment Reminders ---------- */

export const sendPaymentReminder = (serviceId: number, token: string) =>
  apiPost(`/payment/send-reminder`, { serviceId }, token);

export const runPaymentReminders = (token: string) =>
  apiPost("/payment/run-reminders", {}, token);
