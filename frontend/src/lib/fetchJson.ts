const API_BASE = import.meta.env.VITE_API_URL;

export async function fetchJson(
  input: RequestInfo,
  init: RequestInit = {}
): Promise<any> {
  try {
    // Construct full URL if input is a relative path
    const url =
      typeof input === "string" && !input.startsWith("http")
        ? `${API_BASE.replace(/\/$/, "")}/${input.replace(/^\//, "")}`
        : input;

    // Default headers
    const headers = {
      "Content-Type": "application/json",
      ...init.headers,
    };

    // Optionally add auth token here if using JWTs
     const token = localStorage.getItem("token");
     if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { ...init, headers });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }

    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return await res.json();
    } else if (contentType?.includes("text/")) {
      return await res.text(); // fallback for plain text
    }

    return {}; // fallback for unknown content-type
  } catch (err: any) {
    console.error("fetchJson error:", err);
    throw new Error(err?.message || "Unknown network or parsing error");
  }
}
