// frontend/src/worker.ts - Updated with service bindings for API proxying
export interface Env {
  ASSETS: Fetcher;
  API_WORKER: Fetcher;
  NOTIFICATION_WORKER: Fetcher;
  PAYMENT_WORKER: Fetcher;
  ENVIRONMENT?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    console.log(`Frontend worker handling: ${url.pathname}`);
    
    // Handle API requests by proxying to appropriate worker via service bindings
    if (url.pathname.startsWith('/api/')) {
      console.log('Proxying API request via service binding');
      
      // Remove /api prefix for the actual worker
      const apiPath = url.pathname.replace('/api', '');
      const apiUrl = new URL(apiPath, 'https://internal.api');
      apiUrl.search = url.search;
      
      const apiRequest = new Request(apiUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      try {
        // Route to appropriate worker based on path
        if (apiPath.startsWith('/notifications/')) {
          console.log('→ Routing to NOTIFICATION_WORKER');
          return await env.NOTIFICATION_WORKER.fetch(apiRequest);
        } else if (apiPath.startsWith('/payment/')) {
          console.log('→ Routing to PAYMENT_WORKER');
          return await env.PAYMENT_WORKER.fetch(apiRequest);
        } else {
          console.log('→ Routing to API_WORKER (main)');
          // Default to main API worker
          return await env.API_WORKER.fetch(apiRequest);
        }
      } catch (error) {
        console.error('Service binding proxy error:', error);
        return new Response(JSON.stringify({ 
          error: 'Service temporarily unavailable',
          details: error instanceof Error ? error.message : 'Unknown error'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Handle static assets and SPA routing
    try {
      // Try to get the static asset first
      const assetResponse = await env.ASSETS.fetch(request);
      
      // If asset exists and is successful, return it
      if (assetResponse.status < 400) {
        const response = new Response(assetResponse.body, {
          status: assetResponse.status,
          headers: assetResponse.headers
        });
        
        // Cache static assets but not HTML files
        if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|webp)$/)) {
          response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        }
        
        return response;
      }
      
      // For SPA routing - serve index.html for non-asset requests
      const indexRequest = new Request(
        new URL('/index.html', request.url).toString(),
        {
          method: 'GET',
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
