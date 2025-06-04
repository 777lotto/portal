// worker/src/utils.ts
// CORS headers
export const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

// Fix: Explicitly type ResponseInit to help TypeScript
export function errorResponse(message: string, status: number = 400): Response {
  const init: ResponseInit = {
    status,
    headers: CORS,
  };
  return new Response(JSON.stringify({ error: message }), init);
}

export function jsonResponse(data: any, status: number = 200): Response {
  const init: ResponseInit = {
    status,
    headers: CORS,
  };
  return new Response(JSON.stringify(data), init);
}

// Helper for CORS preflight requests
export function handleCorsPreflightRequest(): Response {
  const init: ResponseInit = {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  };
  return new Response(null, init);
}
