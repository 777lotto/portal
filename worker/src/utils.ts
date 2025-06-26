// worker/src/utils.ts - Corrected
export const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

export function errorResponse(message: string, status: number = 400): Response {
  const init: ResponseInit = { status, headers: CORS };
  return new Response(JSON.stringify({ error: message }), init);
}

// RENAMED from jsonResponse to successResponse
export function successResponse(data: any, status: number = 200): Response {
  const init: ResponseInit = { status, headers: CORS };
  return new Response(JSON.stringify(data), init);
}
