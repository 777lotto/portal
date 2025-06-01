// frontend/src/worker.ts
export interface Env {
  ASSETS: Fetcher;
  API_WORKER: Fetcher;
  NOTIFICATION_WORKER?: Fetcher;
  PAYMENT_WORKER?: Fetcher;
  ENVIRONMENT?: string;
}

interface WorkerModule {
  default: {
    fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
  };
}

const worker: WorkerModule['default'] = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    console.log(`🌐 Frontend worker handling: ${request.method} ${url.pathname}`);
    
    // Handle API requests by proxying to appropriate worker via service bindings
    if (url.pathname.startsWith('/api/')) {
      console.log('🔄 Proxying API request via service binding');
      
      try {
        // Clone the request to ensure we can modify it
        const apiRequest = new Request(request);
        
        // Route to appropriate worker based on path
        if (url.pathname.startsWith('/api/notifications/') && env.NOTIFICATION_WORKER) {
          console.log('→ Routing to NOTIFICATION_WORKER');
          return await env.NOTIFICATION_WORKER.fetch(apiRequest);
          
        } else if (url.pathname.startsWith('/api/payment/') && env.PAYMENT_WORKER) {
          console.log('→ Routing to PAYMENT_WORKER');
          return await env.PAYMENT_WORKER.fetch(apiRequest);
          
        } else {
          console.log('→ Routing to API_WORKER (main)');
          // The main worker handles all /api/* routes
          return await env.API_WORKER.fetch(apiRequest);
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

    // For development, handle the root path specifically
    if (url.pathname === '/' && env.ENVIRONMENT === 'development') {
      // In dev, check if this is the Vite dev server request
      const acceptHeader = request.headers.get('Accept') || '';
      if (!acceptHeader.includes('text/html')) {
        // This might be a Vite HMR request, let it through
        return env.ASSETS.fetch(request);
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
        
        // Add caching headers for static assets
        const assetPath = url.pathname;
        if (assetPath.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|webp)$/)) {
          response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (assetPath.endsWith('.html')) {
          response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        
        return response;
      }
      
      // For SPA routing - serve index.html for non-asset 404s
      if (assetResponse.status === 404 && !url.pathname.includes('.')) {
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
      }
      
      // Return the original response if not handling SPA routing
      return assetResponse;
      
    } catch (error) {
      console.error('❌ Frontend worker error:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  },
};

export default worker;
