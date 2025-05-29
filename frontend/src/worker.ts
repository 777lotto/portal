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
      
      // Create new URL for the target worker - keep the full path including /api
      const targetUrl = new URL(request.url);
      
      // Create the proxied request with the same URL structure
      const proxyRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      });

      try {
        // Route to appropriate worker based on path
        if (url.pathname.startsWith('/api/notifications/')) {
          console.log('→ Routing to NOTIFICATION_WORKER');
          // Remove /api prefix for notification worker
          const notificationUrl = new URL(url.pathname.replace('/api', ''), 'https://notification.internal');
          notificationUrl.search = url.search;
          
          const notificationRequest = new Request(notificationUrl.toString(), {
            method: request.method,
            headers: request.headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          });
          
          return await env.NOTIFICATION_WORKER.fetch(notificationRequest);
          
        } else if (url.pathname.startsWith('/api/payment/')) {
          console.log('→ Routing to PAYMENT_WORKER');
          // Remove /api prefix for payment worker
          const paymentUrl = new URL(url.pathname.replace('/api', ''), 'https://payment.internal');
          paymentUrl.search = url.search;
          
          const paymentRequest = new Request(paymentUrl.toString(), {
            method: request.method,
            headers: request.headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          });
          
          return await env.PAYMENT_WORKER.fetch(paymentRequest);
          
        } else {
          console.log('→ Routing to API_WORKER (main)');
          // For main API worker, we need to remove /api prefix since Hono routes don't expect it
          const mainApiUrl = new URL(url.pathname.replace('/api', '') || '/', 'https://main.internal');
          mainApiUrl.search = url.search;
          
          const mainApiRequest = new Request(mainApiUrl.toString(), {
            method: request.method,
            headers: request.headers,
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
          });
          
          console.log(`📤 Forwarding to main API: ${mainApiRequest.url}`);
          const response = await env.API_WORKER.fetch(mainApiRequest);
          
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
