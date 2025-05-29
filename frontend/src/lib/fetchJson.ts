// frontend/src/lib/fetchJson.ts - Updated for better development experience
const isDev = import.meta.env.DEV;

// In development, try multiple endpoints to find working one
const API_BASES = isDev ? [
  'http://localhost:8788/api',  // Frontend worker (preferred)
  'http://localhost:8787/api',  // Direct to main worker
  'https://portal.777.foo/api'  // Production fallback
] : ['https://portal.777.foo/api'];

// Track which API base is currently working
let workingApiBase: string | null = null;

async function findWorkingApiBase(): Promise<string> {
  if (workingApiBase) {
    return workingApiBase;
  }

  for (const base of API_BASES) {
    try {
      console.log(`🔍 Testing API base: ${base}`);
      const response = await fetch(`${base}/ping`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (response.ok) {
        console.log(`✅ Found working API base: ${base}`);
        workingApiBase = base;
        return base;
      }
    } catch (error) {
      console.log(`❌ API base not working: ${base}`, error);
    }
  }

  // If nothing works, use the first one as fallback
  const fallback = API_BASES[0];
  console.warn(`⚠️  No working API base found, using fallback: ${fallback}`);
  workingApiBase = fallback;
  return fallback;
}

export async function fetchJson(
  input: RequestInfo,
  init: RequestInit = {},
): Promise<any> {
  // Get the working API base
  const API_BASE = await findWorkingApiBase();
  
  // Build full URL
  let url: string;
  if (typeof input === 'string') {
    if (input.startsWith('http')) {
      // Already a full URL
      url = input;
    } else {
      // Relative path - combine with API base
      const cleanBase = API_BASE.replace(/\/$/, '');
      const cleanPath = input.replace(/^\//, '');
      url = `${cleanBase}/${cleanPath}`;
    }
  } else {
    url = input.url;
  }

  console.log('🌐 Making API request to:', url);

  // Merge headers safely
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.method !== 'GET') {
    headers.set("Content-Type", "application/json");
  }

  // Add auth token if available
  const token = localStorage.getItem("token");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    console.log('🔑 Added auth token to request');
  }

  const requestOptions: RequestInit = {
    ...init,
    headers,
    // Use cors mode for cross-origin requests in development
    mode: isDev && !url.startsWith(window.location.origin) ? 'cors' : 'same-origin',
    credentials: isDev && !url.startsWith(window.location.origin) ? 'omit' : 'same-origin',
  };

  console.log('📤 Request options:', {
    method: requestOptions.method || 'GET',
    url,
    headers: Object.fromEntries(headers.entries()),
    hasBody: !!requestOptions.body,
    mode: requestOptions.mode,
    credentials: requestOptions.credentials
  });

  try {
    const res = await fetch(url, requestOptions);
    
    console.log('📥 Response status:', res.status);
    console.log('📥 Response headers:', Object.fromEntries(res.headers.entries()));
    
    if (!res.ok) {
      let errorText: string;
      const contentType = res.headers.get("content-type") || "";
      
      if (contentType.includes("application/json")) {
        const errorData = await res.json() as { error?: string; message?: string };
        errorText = errorData.error || errorData.message || `HTTP ${res.status}`;
        console.error('❌ API Error (JSON):', errorData);
      } else {
        errorText = await res.text();
        console.error('❌ API Error (Text):', errorText);
      }
      
      // If we get a network error and we're in dev, try to find a new working base
      if (res.status >= 500 && isDev) {
        console.log('🔄 Server error in dev mode, clearing working API base to retry');
        workingApiBase = null;
      }
      
      throw new Error(errorText);
    }

    const responseContentType = res.headers.get("content-type") || "";
    
    if (responseContentType.includes("application/json")) {
      const data = await res.json();
      console.log('✅ API Response (JSON):', data);
      return data;
    } else if (responseContentType.startsWith("text/")) {
      const text = await res.text();
      console.log('✅ API Response (Text):', text);
      return text;
    } else {
      console.log('✅ API Response (Empty)');
      return {};
    }
  } catch (error) {
    console.error('❌ Fetch error:', error);
    
    // If we get a network error in development, clear the working base and try again once
    if (isDev && workingApiBase && error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.log('🔄 Network error in dev mode, trying to find new working API base');
      workingApiBase = null;
      
      // Try once more with a new base
      try {
        return await fetchJson(input, init);
      } catch (retryError) {
        console.error('❌ Retry also failed:', retryError);
      }
    }
    
    // Provide more helpful error messages
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Unable to connect to server. Please check your internet connection and try again.');
    }
    
    throw error;
  }
}

// Utility function to reset the API base (useful for debugging)
export function resetApiBase() {
  workingApiBase = null;
  console.log('🔄 API base reset, will auto-detect on next request');
}
