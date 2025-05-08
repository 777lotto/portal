const API_BASE = import.meta.env.VITE_API_URL;

export async function fetchJson(
  input: RequestInfo,
  init: RequestInit = {},
): Promise<any> {
  // Full URL if relative
  const url =
    typeof input === "string" && !input.startsWith("http")
      ? `${API_BASE.replace(/\/$/, "")}/${input.replace(/^\//, "")}`
      : input;

  // Merge headers safely
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  // Optional auth token
  // const token = localStorage.getItem("token");
  // if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const type = res.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return res.json();
  if (type.startsWith("text/")) return res.text();
  return {};
}

