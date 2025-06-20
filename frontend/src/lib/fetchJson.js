// frontend/src/lib/fetchJson.ts - Improved error handling and API communication
const API_BASE = import.meta.env.VITE_API_URL || '';
export class ApiError extends Error {
    status;
    details;
    constructor(message, status, details) {
        super(message);
        this.status = status;
        this.details = details;
        this.name = 'ApiError';
    }
}
export async function fetchJson(input, init = {}) {
    // Build full URL
    let url;
    if (input.startsWith('http')) {
        url = input;
    }
    else {
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
    const requestOptions = {
        ...init,
        headers,
        // Ensure cookies are sent in production
        credentials: 'same-origin',
    };
    try {
        const startTime = Date.now();
        const res = await fetch(url, requestOptions);
        const duration = Date.now() - startTime;
        console.log(`📥 API Response: ${res.status} (${duration}ms)`);
        // Handle non-OK responses
        if (!res.ok) {
            let errorMessage = `HTTP ${res.status}`;
            let errorDetails = undefined;
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                try {
                    const errorData = await res.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                    errorDetails = errorData.details;
                    console.error('❌ API Error:', errorData);
                }
                catch (e) {
                    console.error('Failed to parse error response:', e);
                    errorMessage = `${res.status} - ${res.statusText}`;
                }
            }
            else {
                const text = await res.text();
                if (text) {
                    errorMessage = text.substring(0, 200); // Limit error message length
                }
            }
            // Handle specific status codes
            if (res.status === 401) {
                console.log('🚪 401 Unauthorized - clearing token and redirecting to login');
                localStorage.removeItem("token");
                // Only redirect if we're not already on the login page
                if (!window.location.pathname.includes('/login')) {
                    // Store the current path to redirect back after login
                    const returnPath = window.location.pathname + window.location.search;
                    if (returnPath && returnPath !== '/') {
                        sessionStorage.setItem('returnPath', returnPath);
                    }
                    window.location.href = "/login";
                }
                throw new ApiError("Session expired. Please log in again.", 401);
            }
            throw new ApiError(errorMessage, res.status, errorDetails);
        }
        // Parse response based on content type
        const responseContentType = res.headers.get("content-type") || "";
        if (responseContentType.includes("application/json")) {
            const data = await res.json();
            console.log('✅ API Success:', data);
            return data;
        }
        else if (responseContentType.includes("text/")) {
            const text = await res.text();
            return text;
        }
        else if (responseContentType.includes("text/calendar")) {
            // Handle iCal responses
            const text = await res.text();
            return text;
        }
        else {
            // No content or unknown type
            console.log('📭 No content or unknown content type:', responseContentType);
            return {};
        }
    }
    catch (error) {
        console.error('❌ Fetch error:', error);
        // Network errors
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            throw new ApiError('Unable to connect to server. Please check your internet connection.', 0);
        }
        // Re-throw ApiErrors as-is
        if (error instanceof ApiError) {
            throw error;
        }
        // Wrap other errors
        throw new ApiError(error instanceof Error ? error.message : 'An unexpected error occurred', 0);
    }
}
