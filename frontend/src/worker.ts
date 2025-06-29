// 777lotto/portal/portal-raise/frontend/src/worker.ts

export interface Env {
  ASSETS: Fetcher;
  API_WORKER: Fetcher;
  // Define other service bindings if you have them, e.g.:
  // NOTIFICATION_WORKER: Fetcher;
}

const worker: {
  fetch(request: Request, env: Env): Promise<Response>;
} = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // If the request is for an API endpoint, proxy it to the API worker.
    // This single binding is sufficient as your main API worker handles all sub-routes.
    if (url.pathname.startsWith('/api/')) {
      return env.API_WORKER.fetch(request);
    }

    // Otherwise, serve the static asset from the Pages build.
    return env.ASSETS.fetch(request);
  },
};

export default worker;
