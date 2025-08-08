// frontend/src/lib/fetchJson.ts - Improved error handling and API communication
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

export async function fetchJson<T = unknown>(
  input: string,
  init: RequestInit = {}
): Promise<T> {
  // Build full URL
  let url: string;
  if (input.startsWith('http')) {
    url = input;
  } else {
    // Ensure proper path joining
    const base = API_BASE || '';
    const path = input.startsWith('/') ? input : `/${input}`;
    url = base + path;
  }

  console.log(`🌐 API Request: ${init.method || 'GET'} ${url}`);

  // Merge headers safely
  const headers = new Headers(init.headers);

  // Set default content type if not provided
  if (!headers.has('Content-Type') && init.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  // Add auth token if available
  const token = localStorage.getItem("token");
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
    console.log('🔐 Added auth token to request');
  }

  const requestOptions: RequestInit = {
    ...init,
    headers,
    // Ensure cookies are sent in production
    credentials: 'same-origin',
  };

  // Ensure GET/HEAD requests do not have a body
  const method = (requestOptions.method || 'GET').toUpperCase();
  if ((method === 'GET' || method === 'HEAD') && requestOptions.body) {
    delete requestOptions.body;
  }

  try {
    const startTime = Date.now();
    const res = await fetch(url, requestOptions);
    const duration = Date.now() - startTime;

    console.log(`📥 API Response: ${res.status} (${duration}ms)`);

    // Handle non-OK responses
    if (!res.ok) {
      let errorMessage: string = `HTTP ${res.status}`;
      let errorDetails: any = undefined;

      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        try {
          const errorData = await res.json() as ApiErrorResponse;
          errorMessage = errorData.error || errorData.message || errorMessage;
          errorDetails = errorData.details;
          console.error('❌ API Error:', errorData);
        } catch (e) {
          console.error('Failed to parse error response:', e);
          errorMessage = `${res.status} - ${res.statusText}`;
        }
      } else {
        const text = await res.text();
        if (text) {
          errorMessage = text.substring(0, 200); // Limit error message length
        }
      }

      // Handle specific status codes
      if (res.status === 401) {
        // A 401 from any page OTHER than login means the session is expired.
        if (!url.endsWith('/api/login')) {
          console.log('🚪 401 Unauthorized - clearing token and redirecting to login');
          localStorage.removeItem("token");

          if (!window.location.pathname.startsWith('/auth')) {
            const returnPath = window.location.pathname + window.location.search;
            if (returnPath && returnPath !== '/') {
              sessionStorage.setItem('returnPath', returnPath);
            }
            window.location.href = "/auth";
          }

          throw new ApiError("Session expired. Please log in again.", 401);
        }
      }

      // For all other errors, including a 401 from the login page,
      // throw the actual error message from the API.
      throw new ApiError(errorMessage, res.status, errorDetails);
    }

    // Parse response based on content type
    const responseContentType = res.headers.get("content-type") || "";

    if (responseContentType.includes("application/json")) {
      const data = await res.json() as T;
      console.log('✅ API Success:', data);
      return data;
    } else if (responseContentType.includes("text/")) {
      const text = await res.text();
      return text as T;
    } else if (responseContentType.includes("text/calendar")) {
      // Handle iCal responses
      const text = await res.text();
      return text as T;
    } else {
      // No content or unknown type
      console.log('📭 No content or unknown content type:', responseContentType);
      return {} as T;
    }
  } catch (error) {
    console.error('❌ Fetch error:', error);

    // Network errors
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new ApiError(
        'Unable to connect to server. Please check your internet connection.',
        0
      );
    }

    // Re-throw ApiErrors as-is
    if (error instanceof ApiError) {
      throw error;
    }

    // Wrap other errors
    throw new ApiError(
      error instanceof Error ? error.message : 'An unexpected error occurred',
      0
    );
  }
}
