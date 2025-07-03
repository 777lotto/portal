// worker/src/utils.ts - Corrected
export const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

// MODIFIED: This function now accepts an optional 'details' object for richer error responses.
export function errorResponse(message: string, status: number = 400, details?: any): Response {
  const body: { error: string, details?: any } = { error: message };
  if (details) {
    body.details = details;
  }
  const init: ResponseInit = { status, headers: CORS };
  return new Response(JSON.stringify(body), init);
}

export function successResponse(data: any, status: number = 200): Response {
  const init: ResponseInit = { status, headers: CORS };
  return new Response(JSON.stringify(data), init);
}
