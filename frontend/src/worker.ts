// frontend/src/worker.ts - Updated for specific routes
export interface Env {
  ASSETS: Fetcher;
  API?: Fetcher;
  ENVIRONMENT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    console.log(`Frontend worker handling: ${url.pathname}`);
    
    // API requests should never reach this worker now
    if (url.pathname.startsWith('/api/')) {
      console.error('API request reached frontend worker - route configuration issue!');
      return new Response('API route misconfiguration', { status: 500 });
    }

    try {
      // Try to get the static asset first
      const assetResponse = await env.ASSETS.fetch(request);
      
      // If asset exists and is successful, return it
      if (assetResponse.status < 400) {
        // Add cache headers for static assets
        const response = new Response(assetResponse.body, {
          status: assetResponse.status,
          headers: assetResponse.headers
        });
        
        // Cache static assets but not HTML files
        if (!url.pathname.endsWith('.html') && 
            (url.pathname.includes('/assets/') || url.pathname.includes('/static/'))) {
          response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        }
        
        return response;
      }
      
      // For SPA routing - serve index.html for non-asset requests
      // This handles all your React Router routes
      const indexRequest = new Request(
        new URL('/index.html', request.url).toString(),
        {
          method: 'GET', // Always GET for index.html
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': request.headers.get('Accept-Language') || 'en-US,en;q=0.5',
          },
        }
      );
      
      const indexResponse = await env.ASSETS.fetch(indexRequest);
      
      if (indexResponse.ok) {
        return new Response(indexResponse.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            // Security headers
            'X-Frame-Options': 'DENY',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
          },
        });
      }
      
      // If we can't serve index.html, return 404
      return new Response('Page not found', { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
      
    } catch (error) {
      console.error('Frontend worker error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  },
};
