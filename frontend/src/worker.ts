// frontend/src/worker.ts - CORRECTED
export interface Env {
  ASSETS: Fetcher;
  API_WORKER: Fetcher;
}

const worker: {
  fetch(request: Request, env: Env): Promise<Response>;
} = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return await env.API_WORKER.fetch(request);
    }

    return await env.ASSETS.fetch(request);
  },
};

export default worker;
