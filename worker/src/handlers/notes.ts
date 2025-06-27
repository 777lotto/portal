// worker/src/handlers/notes.ts
// --------------------------------------
import { Context as NoteContext } from 'hono';
import { AppEnv as NoteAppEnv } from '../index';
import { errorResponse as noteErrorResponse, successResponse as noteSuccessResponse } from '../utils';

export const handleGetNotesForJob = async (c: NoteContext<NoteAppEnv>) => {
    const { jobId } = c.req.param();
    const user = c.get('user');
    // In a real app, you would also check if the user is authorized to see this job
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM notes WHERE job_id = ? ORDER BY created_at DESC`
        ).bind(jobId).all();
        return noteSuccessResponse(results);
    } catch (e: any) {
        console.error("Failed to get notes:", e.message);
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
        return noteSuccessResponse(results[0], 201);
    } catch (e: any) {
        console.error("Failed to add note:", e.message);
        return noteErrorResponse("Failed to add note", 500);
    }
};
