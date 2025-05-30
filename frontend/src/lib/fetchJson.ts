const API_BASE = import.meta.env.VITE_API_URL || 'https://portal.777.foo/api';

export async function fetchJson(
  input: string,
  init: RequestInit = {},
): Promise<any> {
  // Build full URL
  let url: string;
  if (input.startsWith('http')) {
    url = input;
  } else {
    const cleanBase = API_BASE.replace(/\/$/, '');
    const cleanPath = input.replace(/^\//, '');
    url = `${cleanBase}/${cleanPath}`;
  }

  console.log('🌐 Making API request to:', url);

  // Merge headers safely
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...Object.fromEntries(new Headers(init.headers).entries())
  };

  // Add auth token if available
  const token = localStorage.getItem("token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const requestOptions: RequestInit = {
    ...init,
    headers,
  };

  try {
    const res = await fetch(url, requestOptions);
    
    if (!res.ok) {
      let errorText: string;
      const contentType = res.headers.get("content-type") || "";
      
      if (contentType.includes("application/json")) {
        const errorData = await res.json() as { error?: string; message?: string };
        errorText = errorData.error || errorData.message || `HTTP ${res.status}`;
      } else {
        errorText = await res.text();
      }
      
      throw new Error(errorText);
    }

    const responseContentType = res.headers.get("content-type") || "";
    
    if (responseContentType.includes("application/json")) {
      return await res.json();
    } else if (responseContentType.startsWith("text/")) {
      return await res.text();
    } else {
      return {};
    }
  } catch (error) {
    console.error('❌ Fetch error:', error);
    
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Unable to connect to server. Please check your internet connection and try again.');
    }
    
    throw error;
  }
}
