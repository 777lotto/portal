// frontend/src/worker.ts - New Worker entry point for static assets
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API requests - proxy to main worker
    if (url.pathname.startsWith('/api/')) {
      // If you have the API worker binding, use it
      if (env.API) {
        return env.API.fetch(request);
      }
      
      // Otherwise, proxy to the API worker
      const apiUrl = new URL(request.url);
      apiUrl.hostname = 'portal.777.foo'; // or your API domain
      
      return fetch(new Request(apiUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' 
          ? request.body 
          : undefined,
      }));
    }

    // Handle static assets
    try {
      // Try to get the static asset
      const assetResponse = await env.ASSETS.fetch(request);
      
      // If asset exists, return it
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
      
      // For SPA routing - serve index.html for non-asset requests
      if (!url.pathname.includes('.')) {
        const indexResponse = await env.ASSETS.fetch(
          new Request(new URL('/index.html', request.url).toString())
        );
        
        // Set proper headers for SPA routing
        return new Response(indexResponse.body, {
          ...indexResponse,
          headers: {
            ...Object.fromEntries(indexResponse.headers.entries()),
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache', // Don't cache the SPA shell
          },
        });
      }
      
      // Return 404 for actual missing assets
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      console.error('Static asset error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
