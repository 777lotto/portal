/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx) {
	  const url = new URL(request.url);
	  // Route: GET /api/ping
	  if (url.pathname === '/api/ping' && request.method === 'GET') {
		return new Response(JSON.stringify({ message: 'pong' }), {
		  headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',         // for dev; tighten later
			'Access-Control-Allow-Methods': 'GET,OPTIONS',
		  }
		});
	  }
  
	  // Fallback: Hello World
	  return new Response('Hello World!', {
		headers: { 'content-type': 'text/plain' }
	  });
	}
  } satisfies ExportedHandler<Env>;
  
