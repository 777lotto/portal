import { fetchJson } from "./fetchJson";

const API_URL = "https://worker.mwb-67d.workers.dev/api";

export async function login(email: string, password: string): Promise<string> {
  const data = await fetchJson(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return data.token;
}

export async function signup(email: string, name: string, password: string): Promise<{ token: string }> {
  const data = await fetchJson(`${API_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  });
  return data;
}

export async function apiGet(path: string, token?: string) {
  const data = await fetchJson(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return data;
}
