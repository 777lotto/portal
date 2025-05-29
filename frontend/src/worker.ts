// frontend/src/worker.ts - Fixed API routing
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
    
    console.log(`🌐 Frontend worker handling: ${request.method} ${url.pathname}`);
    
    // Handle API requests by proxying to appropriate worker via service bindings
    if (url.pathname.startsWith('/api/')) {
      console.log('🔄 Proxying API request via service binding');
      
      try {
        // Route to appropriate worker based on path
        if (url.pathname.startsWith('/api/notifications/')) {
          console.log('→ Routing to NOTIFICATION_WORKER');
          // Forward the full request to notification worker
          return await env.NOTIFICATION_WORKER.fetch(request);
          
        } else if (url.pathname.startsWith('/api/payment/')) {
          console.log('→ Routing to PAYMENT_WORKER');
          // Forward the full request to payment worker
          return await env.PAYMENT_WORKER.fetch(request);
          
        } else {
          console.log('→ Routing to API_WORKER (main)');
          // For main API worker, forward the full request
          console.log(`📤 Forwarding to main API: ${request.url}`);
          const response = await env.API_WORKER.fetch(request);
          
          console.log(`📥 Response from main API: ${response.status}`);
          return response;
        }
      } catch (error) {
        console.error('❌ Service binding proxy error:', error);
        return new Response(JSON.stringify({ 
          error: 'Service temporarily unavailable',
          details: error instanceof Error ? error.message : 'Unknown error',
          path: url.pathname,
          method: request.method
        }), {
          status: 503,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        });
      }
    }

    // Handle CORS preflight for non-API requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
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
      console.error('❌ Frontend worker error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  },
};
