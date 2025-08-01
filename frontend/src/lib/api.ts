// frontend/src/lib/api.ts

import { hc } from 'hono/client';
// Import the type definition for the API routes from your Cloudflare Worker.
import type { ApiRoutes } from '../../../worker/src/index';
// Import your custom fetch function.
import { fetchJson } from './fetchJson';

// Create the Hono client.
const client = hc<ApiRoutes>(import.meta.env.VITE_API_URL, {
  // Tell the Hono client to use your custom fetchJson function for all requests.
  // This preserves your custom logic for adding auth headers and handling 401 errors.
  fetch: fetchJson,
});

// Export the 'api' branch of the client.
export const api = client.api;
