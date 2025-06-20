// frontend/src/lib/api.ts - Fixed with proper types
import { fetchJson } from "./fetchJson";
/* ---------- low-level helpers ---------- */
// Make the helpers generic to pass types through to fetchJson
export const apiGet = (path, token) => fetchJson(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
});
export const apiPost = (path, body, token, method = "POST") => fetchJson(path, {
    method,
    headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
});
/* ---------- auth ---------- */
// Specify the expected response types for each endpoint
export const checkStripeCustomer = (email, phone) => apiPost("/stripe/check-customer", { email, phone });
export const createStripeCustomer = (email, name, phone) => apiPost("/stripe/create-customer", { email, name, phone });
export const login = (identifier, password, turnstileToken) => apiPost("/login", { identifier, password, turnstileToken });
export const signup = (email, name, password, phone) => apiPost("/signup", { email, name, password, phone });
export const signupCheck = (email, phone, turnstileToken) => apiPost("/signup/check", { email, phone, turnstileToken });
/* ---------- services ---------- */
export const getServices = (token) => apiGet("/services", token);
export const getService = (id, token) => apiGet(`/services/${id}`, token);
/* ---------- jobs ---------- */
export const getJobs = (token) => apiGet("/jobs", token);
export const getJob = (id, token) => apiGet(`/jobs/${id}`, token);
/* ---------- profile ---------- */
export const getProfile = (token) => apiGet("/profile", token);
export const updateProfile = (profileData, token) => apiPost("/profile", profileData, token, "PUT");
export const requestPasswordReset = (email, turnstileToken) => apiPost("/request-password-reset", { email, turnstileToken });
/* ---------- invoices ---------- */
export const getInvoice = (serviceId, token) => apiGet("/services/${serviceId}/invoice", token);
/* ---------- Stripe Customer Portal ---------- */
export const openPortal = (token) => apiPost("/portal", {}, token);
/* ---------- Calendar Integration ---------- */
export const getCalendarFeed = (token) => `${window.location.origin}/api/calendar-feed?token=${token}`;
export const syncCalendar = (calendarUrl, token) => apiPost("/calendar-sync", { calendarUrl }, token);
/* ---------- Worker Service Binding ---------- */
export const callWorkerService = (serviceName, path, data, token) => apiPost(`/worker-service/${serviceName}${path}`, data || {}, token);
// Helper functions for specific worker services
export const callNotificationService = (action, data, token) => callWorkerService('notification', `/${action}`, data, token);
export const callPaymentProcessingService = (action, data, token) => callWorkerService('payment', `/${action}`, data, token);
export const callSchedulingService = (action, data, token) => callWorkerService('scheduling', `/${action}`, data, token);
// Specific notification functions
export const sendEmailNotification = (emailData, token) => callNotificationService('send-email', emailData, token);
export const sendSmsNotification = (smsData, token) => callNotificationService('send-sms', smsData, token);
// Specific payment processing functions
export const processPayment = (paymentData, token) => callPaymentProcessingService('process', paymentData, token);
export const refundPayment = (refundData, token) => callPaymentProcessingService('refund', refundData, token);
// Specific scheduling functions
export const checkAvailability = (date, token) => callSchedulingService('check-availability', { date }, token);
export const scheduleJob = (jobData, token) => callSchedulingService('schedule', jobData, token);
export const rescheduleJob = (id, newDate, token) => callSchedulingService('reschedule', { id, newDate }, token);
/* ---------- SMS ---------- */
export const getConversations = (token) => apiGet("/sms/conversations", token);
export const getConversation = (phoneNumber, token) => apiGet(`/sms/messages/${phoneNumber}`, token);
export const sendSMS = (to, message, token) => apiPost("/sms/send", { to, message }, token);
/* ---------- Payment Reminders ---------- */
export const sendPaymentReminder = (serviceId, token) => apiPost(`/payment/send-reminder`, { serviceId }, token);
export const runPaymentReminders = (token) => apiPost("/payment/run-reminders", {}, token);
