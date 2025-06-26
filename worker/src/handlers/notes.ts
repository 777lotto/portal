// worker/src/handlers/notes.ts - CORRECTED

import { errorResponse } from '../utils';
import type { AppContext } from '../index';

export async function handleGetNotesForJob(c: AppContext): Promise<Response> {
  const user = c.get('user');
  const env = c.env;
  const jobId = c.req.param('id');
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM notes WHERE job_id = ? AND user_id = ?"
    ).bind(jobId, user.id).all();
    return c.json(results || []);
  } catch (e: any) {
    console.error(`Error fetching notes for job ${jobId}:`, e);
    return errorResponse(e.message, 500);
  }
}

export async function handleAdminAddNote(c: AppContext): Promise<Response> {
  const env = c.env;
  try {
    const targetUserId = c.req.param('userId');
    const { content, job_id, service_id, photo_id } = await c.req.json();

    if (!content) {
      return errorResponse('Note content is required.', 400);
    }

    const { meta } = await env.DB.prepare(
      `INSERT INTO notes (user_id, content, job_id, service_id, photo_id) VALUES (?, ?, ?, ?, ?)`
    ).bind(targetUserId, content, job_id || null, service_id || null, photo_id || null).run();

    return c.json({ success: true, id: meta.last_row_id }, 201);
  } catch (e: any) {
    console.error("Error adding note:", e);
    return errorResponse('An internal server error occurred', 500);
  }
}
