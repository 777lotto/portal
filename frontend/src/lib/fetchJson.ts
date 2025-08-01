// frontend/src/lib/fetchJson.ts - Updated to work with Hono RPC Client

const API_BASE = import.meta.env.VITE_API_URL || '';

interface ApiErrorResponse {
  error?: string;
  message?: string;
  details?: any;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// The function signature is updated to match the standard `fetch` API.
// It now accepts a `Request` object or a URL, and returns a `Promise<Response>`.
export async function fetchJson(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const request = new Request(input, init);

  // Add auth token if available, creating a new request since they are immutable
  const token = localStorage.getItem("token");
  if (token && !request.headers.has('Authorization')) {
    request.headers.set('Authorization', `Bearer ${token}`);
    console.log('🔐 Added auth token to request');
  }

  // Ensure cookies are sent in production
  if (!request.credentials) {
    (request as any).credentials = 'same-origin';
  }

  console.log(`🌐 API Request: ${request.method} ${request.url}`);

  try {
    const startTime = Date.now();
    const res = await fetch(request);
    const duration = Date.now() - startTime;

    console.log(`📥 API Response: ${res.status} (${duration}ms)`);

    if (!res.ok) {
      let errorMessage: string = `HTTP ${res.status}`;
      let errorDetails: any = undefined;

      const contentType = res.headers.get("content-type") || "";

      // We still want to parse the JSON from an error response to get a good message.
      if (contentType.includes("application/json")) {
        try {
          // Clone the response to read it, as the body can only be read once.
          const errorData = await res.clone().json() as ApiErrorResponse;
          errorMessage = errorData.error || errorData.message || errorMessage;
          errorDetails = errorData.details;
          console.error('❌ API Error:', errorData);
        } catch (e) {
          console.error('Failed to parse error response:', e);
          errorMessage = `${res.status} - ${res.statusText}`;
        }
      } else {
        const text = await res.clone().text();
        if (text) {
          errorMessage = text.substring(0, 200);
        }
      }

      if (res.status === 401) {
        if (!request.url.endsWith('/api/login')) {
          console.log('🚪 401 Unauthorized - clearing token and redirecting to login');
          localStorage.removeItem("token");

          if (!window.location.pathname.includes('/login')) {
            const returnPath = window.location.pathname + window.location.search;
            if (returnPath && returnPath !== '/') {
              sessionStorage.setItem('returnPath', returnPath);
            }
            window.location.href = "/login";
          }

          throw new ApiError("Session expired. Please log in again.", 401);
        }
      }

      throw new ApiError(errorMessage, res.status, errorDetails);
    }

    // On success, we now return the raw `Response` object.
    // The Hono client will handle reading the JSON body from here.
    return res;

  } catch (error) {
    console.error('❌ Fetch error:', error);

    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new ApiError(
        'Unable to connect to server. Please check your internet connection.',
        0
      );
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      0
    );
  }
}
