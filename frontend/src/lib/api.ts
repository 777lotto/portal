// src/lib/api.ts
import { fetchJson } from "./fetchJson";
import { Job } from '@portal/shared/calendar';

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

// Add these functions to api.ts

export const checkStripeCustomer = (email: string) =>
  apiPost("/stripe/check-customer", { email });

export const createStripeCustomer = (email: string, name: string) =>
  apiPost("/stripe/create-customer", { email, name });

export const requestPasswordReset = (email: string) =>
  apiPost("/password-reset/request", { email });

export const completePasswordReset = (token: string, newPassword: string) =>
  apiPost("/password-reset/complete", { token, newPassword });

export const login = (email: string, password: string) =>
  apiPost("/login", { email, password });

export const signup = (email: string, name: string, password: string) =>
  apiPost("/signup", { email, name, password });

export const signupCheck = (email: string) =>
  apiPost("/signup/check", { email });

/* ---------- services ---------- */

export const getServices = (token: string) =>
  apiGet("/services", token);

export const getService = (id: number, token: string) =>
  apiGet(`/services/${id}`, token);

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

/* ---------- invoices ---------- */

export const getInvoice = (serviceId: number, token: string) =>
  apiGet(`/services/${serviceId}/invoice`, token);

/* ---------- Stripe Customer Portal ---------- */

export const openPortal = (token: string) =>
  apiPost("/portal", {}, token);

/* ---------- Calendar Integration ---------- */

export const getCalendarFeed = (token: string) =>
  `${window.location.origin}/api/calendar-feed?token=${token}`;

export const syncCalendar = (calendarUrl: string, token: string) =>
  apiPost("/calendar-sync", { calendarUrl }, token);
