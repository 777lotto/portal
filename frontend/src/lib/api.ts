// src/lib/api.ts

const API_URL = "https://worker.mwb-67d.workers.dev/api";

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to login");
  }

  const data = await res.json();
  return data.token;
}

export async function apiGet(path: string, token?: string) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Failed to fetch");
  }

  return await res.json();
}
