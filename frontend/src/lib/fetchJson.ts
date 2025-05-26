// frontend/src/lib/fetchJson.ts - Fixed TypeScript errors
const API_BASE = import.meta.env.VITE_API_URL || 'https://portal.777.foo/api';

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
    headers
  };

  console.log('📤 Request options:', {
    method: requestOptions.method || 'GET',
    url,
    headers: Object.fromEntries(headers.entries()),
    hasBody: !!requestOptions.body
  });

  try {
    const res = await fetch(url, requestOptions);
    
    console.log('📥 Response status:', res.status);
    
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
    throw error;
  }
}
