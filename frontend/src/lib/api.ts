// frontend/src/lib/api.ts - Cleaned, organized, and corrected

import { fetchJson } from "./fetchJson";
import type { Job, Service, User, AuthResponse, PortalSession, Conversation, SMSMessage } from "@portal/shared";

/* ========================================================================
   1. LOW-LEVEL API HELPERS
   ======================================================================== */

const apiGet = <T>(path: string, token: string): Promise<T> =>
  fetchJson<T>(path, { headers: { Authorization: `Bearer ${token}` } });

const apiPost = <T>(path:string, body: unknown, token: string, method: "POST" | "PUT" = "POST"): Promise<T> =>
  fetchJson<T>(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
  });

const publicApiPost = <T>(path: string, body: unknown) =>
    fetchJson<T>(path, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

/* ========================================================================
   2. EXPORTED API FUNCTIONS (SDK)
   ======================================================================== */

// ---------- Auth & Public Endpoints ----------
export const login = (identifier: string, password: string, turnstileToken: string) =>
    publicApiPost<AuthResponse>("/api/login", { identifier, password, turnstileToken });

export const signup = (email: string, name: string, password: string, phone: string, turnstileToken: string) =>
    publicApiPost<AuthResponse>("/api/signup", { email, name, password, phone, turnstileToken });

export const requestPasswordReset = (email: string, turnstileToken: string) =>
    publicApiPost<{ message: string }>("/api/request-password-reset", { email, turnstileToken });

// ---------- Profile ----------
export const getProfile = (token: string) =>
  apiGet<User>("/api/profile", token);

// ---------- Services & Invoices ----------
export const getServices = (token: string) =>
  apiGet<Service[]>("/api/services", token);

export const getService = (id: number | string, token: string) =>
  apiGet<Service>(`/api/services/${id}`, token);

export const createInvoice = (serviceId: number | string, token: string) =>
  apiPost<{ hosted_invoice_url: string }>(`/api/services/${serviceId}/invoice`, {}, token);

// ---------- Jobs & Calendar ----------
export const getJobs = (token: string) =>
  apiGet<Job[]>("/api/jobs", token);

export const getJob = (id: string, token: string) =>
  apiGet<Job>(`/api/jobs/${id}`, token);

export const getCalendarFeed = (token: string) =>
  `${import.meta.env.VITE_API_URL}/api/calendar-feed?token=${token}`;

export const syncCalendar = (calendarUrl: string, token: string) =>
  apiPost("/api/calendar-sync", { calendarUrl }, token);

// ---------- Stripe Customer Portal ----------
export const openPortal = (token: string) =>
  apiPost<PortalSession>("/api/portal", {}, token);

// ---------- SMS ----------
export const getSmsConversations = (token: string) =>
  apiGet<Conversation[]>("/api/sms/conversations", token);

export const getSmsConversation = (phoneNumber: string, token: string) =>
  apiGet<SMSMessage[]>(`/api/sms/messages/${phoneNumber}`, token);

export const sendSms = (to: string, message: string, token: string) =>
  apiPost<SMSMessage>("/api/sms/send", { to, message }, token);
