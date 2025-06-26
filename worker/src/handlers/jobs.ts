// worker/src/handlers/jobs.ts - CORRECTED

import { errorResponse } from '../utils';
import type { AppContext } from '../index';

export async function handleGetJobs(c: AppContext): Promise<Response> {
  const user = c.get('user');
  const env = c.env;
  try {
    const { results } = await env.DB.prepare(
        "SELECT * FROM jobs WHERE customerId = ?"
    ).bind(user.id).all();
    return c.json(results || []);
  } catch (e: any) {
    console.error("Error fetching jobs:", e);
    return errorResponse(e.message, 500);
  }
}

export async function handleGetJobById(c: AppContext): Promise<Response> {
  const user = c.get('user');
  const env = c.env;
  const jobId = c.req.param('id');
  try {
    const job = await env.DB.prepare(
      "SELECT * FROM jobs WHERE id = ? AND customerId = ?"
    ).bind(jobId, user.id).first();

    if (!job) {
      return errorResponse("Job not found", 404);
    }
    return c.json(job);
  } catch (e: any) {
    console.error(`Error fetching job ${jobId}:`, e);
    return errorResponse(e.message, 500);
  }
}

export async function handleCalendarFeed(c: AppContext): Promise<Response> {
    // This is a placeholder for a more complex iCal feed generation logic
    const user = c.get('user');
    console.log(`Generating calendar feed for user ${user.id}`);
    const VCALENDAR_CONTENT = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//My App//EN\nEND:VCALENDAR`;
    return new Response(VCALENDAR_CONTENT, { headers: { "Content-Type": "text/calendar" } });
}
