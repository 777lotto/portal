import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema.js';

export const db = (d1: D1Database) => drizzle(d1, { schema });
