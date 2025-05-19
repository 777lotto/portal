// worker/src/utils.ts

// CORS headers
export const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

// A helper function for standardized error responses
export function errorResponse(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: CORS,
    }
  );
}

// Helper for CORS preflight requests
export function handleCorsPreflightRequest(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
