export async function fetchJson(
  input: RequestInfo,
  init?: RequestInit
): Promise<any> {
  const res = await fetch(input, init);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed: ${res.status} ${text}`);
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json();
  } else {
    return {};
  }
}
