// frontend/src/worker.ts
export interface Env {
  ASSETS: Fetcher;
  API?: Fetcher;
  ENVIRONMENT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API requests - let them pass through to main worker
    if (url.pathname.startsWith('/api/')) {
      // For API requests, we want them to be handled by the main worker
      // Since this frontend worker doesn't handle API routes, 
      // they should be caught by the main worker's route pattern
      return new Response('API route - should be handled by main worker', { status: 404 });
    }

    // Handle static assets
    try {
      // Try to get the static asset first
      const assetResponse = await env.ASSETS.fetch(request);
      
      // If asset exists and is successful, return it
      if (assetResponse.status < 400) {
        return assetResponse;
      }
      
      // For SPA routing - serve index.html for non-asset requests
      // This handles all your React Router routes
      const indexRequest = new Request(
        new URL('/index.html', request.url).toString(),
        {
          method: request.method,
          headers: request.headers,
        }
      );
      
      const indexResponse = await env.ASSETS.fetch(indexRequest);
      
      if (indexResponse.ok) {
        return new Response(indexResponse.body, {
          status: 200,
          headers: {
            ...Object.fromEntries(indexResponse.headers.entries()),
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });
      }
      
      // Return the original asset response (likely 404)
      return assetResponse;
      
    } catch (error) {
      console.error('Asset serving error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },
};
