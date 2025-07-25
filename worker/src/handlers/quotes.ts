
import { Context } from 'hono';
import { AppEnv } from '../index.js';

export async function getPendingQuotes(c: Context<AppEnv>) {
    const user = c.get('user');
    const env = c.env;

    let jobs;
    if (user.role === 'admin') {
        jobs = await env.DB.prepare(
            `SELECT j.*, u.name as customerName FROM jobs j JOIN users u ON j.customerId = u.id WHERE j.status IN ('pending_quote', 'pending_confirmation')`
        ).all();
    } else {
        jobs = await env.DB.prepare(
            `SELECT * FROM jobs WHERE customerId = ? AND status IN ('pending_quote', 'pending_confirmation')`
        ).bind(user.id).all();
    }

    return c.json(jobs.results);
}
