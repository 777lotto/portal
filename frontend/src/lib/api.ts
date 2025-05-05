// src/lib/api.ts
// src/lib/api.ts
import { fetchJson } from "./fetchJson";

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

export const login   = (email: string, password: string) =>
  apiPost("/login", { email, password });

export const signup  = (email: string, name: string, password: string) =>
  apiPost("/signup", { email, name, password });

export const signupCheck = (email: string) =>
  apiPost("/signup/check", { email });

/* ---------- invoices ---------- */

export const getInvoice = (serviceId: number, token: string) =>
  apiGet(`/services/${serviceId}/invoice`, token);

/* ---------- Stripe Customer Portal ---------- */

export const openPortal = (token: string) =>
  apiPost("/portal", {}, token);
