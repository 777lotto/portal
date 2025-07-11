// worker/src/handlers/notes.ts - CORRECTED
import { Context as NoteContext } from 'hono';
import { AppEnv as NoteAppEnv } from '../index.js';
import { errorResponse as noteErrorResponse, successResponse as noteSuccessResponse } from '../utils.js';

export const handleGetNotesForJob = async (c: NoteContext<NoteAppEnv>) => {
    const { jobId } = c.req.param();
    try {
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
    const { content, job_id } = await c.req.json();

    if (!content) {
        return noteErrorResponse("Note content cannot be empty", 400);
    }

    try {
        const { results } = await c.env.DB.prepare(
            `INSERT INTO notes (user_id, content, job_id) VALUES (?, ?, ?) RETURNING *`
        ).bind(parseInt(userId, 10), content, job_id || null).all();

        if (!results || results.length === 0) {
            return noteErrorResponse("Failed to add note after insert", 500);
        }
        return noteSuccessResponse(results[0], 201);
    } catch (e: any) {
        console.error("Failed to add note:", e);
        return noteErrorResponse("Failed to add note", 500);
    }
};
