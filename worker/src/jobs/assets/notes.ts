// 777lotto/portal/portal-fold/worker/src/handlers/notes.ts
import { Context as NoteContext } from 'hono';
import { AppEnv as NoteAppEnv } from '../../index.js';
import { errorResponse as noteErrorResponse, successResponse as noteSuccessResponse } from '../../utils.js';

export const handleGetNotesForJob = async (c: NoteContext<NoteAppEnv>) => {
    const user = c.get('user');
    const { id: jobId } = c.req.param(); // Correctly destructure 'id' and rename it to 'jobId'
    try {
        // First, get the job to verify ownership or admin status
        const job = await c.env.DB.prepare(
            `SELECT user_id FROM jobs WHERE id = ?`
        ).bind(jobId).first<{ user_id: string }>();

        if (!job) {
            return noteErrorResponse("Job not found", 404);
        }

        if (user.role !== 'admin' && job.user_id !== user.id.toString()) {
            return noteErrorResponse("Access denied", 403);
        }

        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM notes WHERE job_id = ? ORDER BY createdAt DESC`
        ).bind(jobId).all();

        const notes = dbResponse?.results || [];
        return noteSuccessResponse(notes);
    } catch (e: any) {
        return noteErrorResponse("Failed to retrieve notes", 500);
    }
};

export const handleAdminAddNoteForUser = async (c: NoteContext<NoteAppEnv>) => {
    const { user_id } = c.req.param();
    const { content, job_id, photo_id } = await c.req.json();

    if (!content) {
        return noteErrorResponse("Note content cannot be empty", 400);
    }

    try {
        const { results } = await c.env.DB.prepare(
            `INSERT INTO notes (user_id, content, job_id, photo_id) VALUES (?, ?, ?, ?) RETURNING *`
        ).bind(parseInt(user_id, 10), content, job_id || null, photo_id || null).all();

        if (!results || results.length === 0) {
            return noteErrorResponse("Failed to add note after insert", 500);
        }
        return noteSuccessResponse(results[0], 201);
    } catch (e: any) {
        console.error("Failed to add note:", e);
        return noteErrorResponse("Failed to add note", 500);
    }
};
