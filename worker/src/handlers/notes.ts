// worker/src/handlers/notes.ts - CORRECTED
import { Context as NoteContext } from 'hono';
import { AppEnv as NoteAppEnv } from '../index.js';
import { errorResponse as noteErrorResponse, successResponse as noteSuccessResponse } from '../utils.js';

export const handleGetNotesForJob = async (c: NoteContext<NoteAppEnv>) => {
    const { jobId } = c.req.param();
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM notes WHERE job_id = ? ORDER BY created_at DESC`
        ).bind(jobId).all();
        return noteSuccessResponse(results);
    } catch (e: any) {
        return noteErrorResponse("Failed to retrieve notes", 500);
    }
};

export const handleAdminAddNote = async (c: NoteContext<NoteAppEnv>) => {
    const { jobId } = c.req.param();
    const { content } = await c.req.json();
    if (!content) {
        return noteErrorResponse("Note content cannot be empty", 400);
    }

    try {
        const { results } = await c.env.DB.prepare(
            `INSERT INTO notes (job_id, content) VALUES (?, ?) RETURNING *`
        ).bind(jobId, content).all();

        // FIX: Add a check to ensure a result was returned before accessing it.
        if (!results || results.length === 0) {
            return noteErrorResponse("Failed to add note after insert", 500);
        }
        return noteSuccessResponse(results[0], 201);
    } catch (e: any) {
        return noteErrorResponse("Failed to add note", 500);
    }
};
