// frontend/src/lib/fetchJson.ts - Updated for service binding approach
const isDev = import.meta.env.DEV;

// With service bindings, we always use the same API base since the frontend worker handles proxying
const API_BASE = isDev 
  ? 'http://localhost:8788/api'  // Development: frontend worker will proxy to other workers
  : 'https://portal.777.foo/api'; // Production: frontend worker will proxy via service bindings

export async function fetchJson(
  input: RequestInfo,
  init: RequestInit = {},
): Promise<any> {
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
    // Use same-origin for both dev and prod since we're going through the frontend worker
    mode: 'same-origin',
    credentials: 'same-origin',
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
    
    // Provide more helpful error messages
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Unable to connect to server. Please check your internet connection and try again.');
    }
    
    throw error;
  }
}
