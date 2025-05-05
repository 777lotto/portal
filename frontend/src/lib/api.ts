// src/lib/api.ts
import { fetchJson } from "./fetchJson";

const API_URL = "https://portal.777.foo/api";

/* ---------- auth helpers ---------- */

export async function login(email: string, password: string): Promise<string> {
  const { token } = await fetchJson(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return token;
}

export async function signup(
  email: string,
  name: string,
  password: string
) {
  // returns { token } just like login
  return await fetchJson(`${API_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  });
}

/** Check whether an email is new or existing (no password yet) */
export async function signupCheck(
  email: string
): Promise<{ status: "new" | "existing"; name?: string }> {
  return await fetchJson(`${API_URL}/signup/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

/* ---------- generic helpers ---------- */

export async function apiGet(path: string, token?: string) {
  return await fetchJson(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function apiPost(
  path: string,
  body: unknown,
  token?: string,
  method: "POST" | "PUT" | "DELETE" = "POST"
) {
  return await fetchJson(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export async function apiDelete(path: string, token: string) {
  return apiPost(path, {}, token, "DELETE");
}

/* ---------- invoice helper ---------- */

/** Fetch hosted_invoice_url for a service */
export async function apiGetInvoice(
  id: number,
  token: string
): Promise<{ hosted_invoice_url: string }> {
  return await fetchJson(`${API_URL}/services/${id}/invoice`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/* ---------- Stripe Customer Portal helper ---------- */

/**
 * Open the Stripe Customer Portal for the current user.
 * Returns { url } pointing to the hosted portal session.
 */
export async function apiPortal(
  token: string
): Promise<{ url: string }> {
  return await fetchJson(`${API_URL}/portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}
