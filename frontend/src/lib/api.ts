import { hc } from 'hono/client';
import type { ApiRoutes } from '../../../worker/src/index';

// Create the Hono client with a custom fetch implementation.
const client = hc<ApiRoutes>(import.meta.env.VITE_API_URL || '/', {
  // This 'fetch' option intercepts every request made by the client.
  fetch: async (input, init, ...args) => {
    const token = localStorage.getItem('token');

    if (token) {
      // If a token exists, add the Authorization header to the request.
      if (!init.headers) {
        init.headers = new Headers();
      }
      // Ensure headers is a Headers object to safely call .set()
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${token}`);
      init.headers = headers;
    }

    // Continue with the original fetch call, now with the added header.
    return fetch(input, init, ...args);
  }
});

export const api = client.api;
