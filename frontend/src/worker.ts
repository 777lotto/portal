// frontend/src/worker.ts
export interface Env {
  ASSETS: Fetcher;
  API_WORKER: Fetcher;
}

const worker: {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
} = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Proxy all API requests to the main worker
    if (url.pathname.startsWith('/api/')) {
      return await env.API_WORKER.fetch(request);
    }

    // Otherwise, serve static assets from the pages build
    return await env.ASSETS.fetch(request);
  },
};

export default worker;
