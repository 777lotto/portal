export async function onRequest(context) {
  // Process the request with the next handler
  const response = await context.next();

  // Add CORS headers to all responses
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS requests for CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: newResponse.headers
    });
  }

  return newResponse;
}
