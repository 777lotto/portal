import { Context as NoteContext } from 'hono';
import { AppEnv as NoteAppEnv } from '../index.js';
import { errorResponse as noteErrorResponse, successResponse as noteSuccessResponse } from '../utils.js';
import type { Job } from '@portal/shared'; // Import Job type

export const handleGetNotesForJob = async (c: NoteContext<NoteAppEnv>) => {
    const user = c.get('user');
    const { jobId } = c.req.param();
    try {
        // SECURITY FIX: Verify the user owns the job before fetching notes
        const job = await c.env.DB.prepare(
            `SELECT id FROM jobs WHERE id = ? AND customerId = ?`
        ).bind(jobId, user.id.toString()).first<Job>();

        if (!job && user.role !== 'admin') {
            return noteErrorResponse("Job not found or access denied", 404);
        }

        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM notes WHERE job_id = ? ORDER BY created_at DESC`
        ).bind(jobId).all();

        const notes = dbResponse?.results || [];
        return noteSuccessResponse(notes);
    } catch (e: any) {
        return noteErrorResponse("Failed to retrieve notes", 500);
    }
};

export const handleAdminAddNoteForUser = async (c: NoteContext<NoteAppEnv>) => {
    const { userId } = c.req.param();
    const { content, job_id, photo_id } = await c.req.json();

    if (!content) {
        return noteErrorResponse("Note content cannot be empty", 400);
    }

    try {
        const { results } = await c.env.DB.prepare(
            `INSERT INTO notes (user_id, content, job_id, photo_id) VALUES (?, ?, ?, ?) RETURNING *`
        ).bind(parseInt(userId, 10), content, job_id || null, photo_id || null).all();

        if (!results || results.length === 0) {
            return noteErrorResponse("Failed to add note after insert", 500);
        }
        return noteSuccessResponse(results[0], 201);
    } catch (e: any) {
        console.error("Failed to add note:", e);
        return noteErrorResponse("Failed to add note", 500);
    }
};
