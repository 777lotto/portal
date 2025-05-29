// frontend/src/worker.ts - Fixed TypeScript version
export interface Env {
  ASSETS: Fetcher;
  API?: Fetcher;
  ENVIRONMENT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API requests - proxy to main worker
    if (url.pathname.startsWith('/api/')) {
      try {
        // Use service binding if available
        if (env.API) {
          return env.API.fetch(request);
        }
        
        // Fallback: proxy to API worker directly
        // Since we don't have the API binding, let the request fall through
        // to the main worker which handles /api/* routes
        return fetch(request);
      } catch (error) {
        console.error('API proxy error:', error);
        return new Response(JSON.stringify({ error: 'API Error' }), { 
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }
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
      if (!url.pathname.includes('.') && !url.pathname.startsWith('/api/')) {
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
