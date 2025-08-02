// frontend/src/lib/api.ts

import { hc } from 'hono/client';
// Import the type definition for the API routes from your Cloudflare Worker.
import type { ApiRoutes } from '../../../worker/src/index';

/**
 * This file configures the Hono RPC client.
 *
 * By removing the custom `fetch` wrapper, we allow API call responses (like 401 errors)
 * to be handled by the components that initiate them (e.g., in TanStack Query's
 * `queryFn` or `onError`), which prevents unexpected page reloads and stuck states.
 */

// Create the Hono client, pointing to your API URL.
// We are no longer using the custom `fetchJson` wrapper.
const client = hc<ApiRoutes>(import.meta.env.VITE_API_URL || '/');

// Export the 'api' branch of the client for use throughout the frontend.
export const api = client.api;
