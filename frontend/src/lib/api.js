// frontend/src/lib/api.ts - Cleaned, organized, and corrected
import { fetchJson } from "./fetchJson";
/* ========================================================================
   1. LOW-LEVEL API HELPERS
   ======================================================================== */
const apiGet = (path, token) => fetchJson(path, { headers: { Authorization: `Bearer ${token}` } });
const apiPost = (path, body, token, method = "POST") => fetchJson(path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
});
const publicApiPost = (path, body) => fetchJson(path, {
    method: 'POST',
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
});
/* ========================================================================
   2. EXPORTED API FUNCTIONS (SDK)
   ======================================================================== */
// ---------- Auth & Public Endpoints ----------
export const login = (identifier, password, turnstileToken) => publicApiPost("/api/login", { identifier, password, turnstileToken });
export const signup = (email, name, password, phone, turnstileToken) => publicApiPost("/api/signup", { email, name, password, phone, turnstileToken });
export const requestPasswordReset = (email, turnstileToken) => publicApiPost("/api/request-password-reset", { email, turnstileToken });
// ---------- Profile ----------
export const getProfile = (token) => apiGet("/api/profile", token);
// ---------- Services & Invoices ----------
export const getServices = (token) => apiGet("/api/services", token);
export const getService = (id, token) => apiGet(`/api/services/${id}`, token);
export const createInvoice = (serviceId, token) => apiPost(`/api/services/${serviceId}/invoice`, {}, token);
// ---------- Jobs & Calendar ----------
export const getJobs = (token) => apiGet("/api/jobs", token);
export const getJob = (id, token) => apiGet(`/api/jobs/${id}`, token);
export const getCalendarFeed = (token) => `${import.meta.env.VITE_API_URL}/api/calendar-feed?token=${token}`;
export const syncCalendar = (calendarUrl, token) => apiPost("/api/calendar-sync", { calendarUrl }, token);
// ---------- Stripe Customer Portal ----------
export const openPortal = (token) => apiPost("/api/portal", {}, token);
// ---------- SMS ----------
export const getSmsConversations = (token) => apiGet("/api/sms/conversations", token);
export const getSmsConversation = (phoneNumber, token) => apiGet(`/api/sms/messages/${phoneNumber}`, token);
export const sendSms = (to, message, token) => apiPost("/api/sms/send", { to, message }, token);
