// 1) Import the D1Database type so TS knows what env.DB is
import { D1Database } from '@cloudflare/workers-types';

// 2) Define your Env interface, matching your Wrangler binding names
export interface Env {
  /** Your D1 database binding (as set in wrangler.jsonc) */
  DB: D1Database;
  /** Your JWT secret (pushed via `wrangler secret put JWT_SECRET`) */
  JWT_SECRET: string;
}

// 3) Extend the Cloudflare Test harness (used by wrangler dev --experimental-test)
declare module 'cloudflare:test' {
  interface ProvidedEnv extends Env {}
}
