// worker/src/handlers/photos.ts
import { Context as PhotoContext } from 'hono';
import { AppEnv as PhotoAppEnv } from '../index.js';
import { errorResponse as photoErrorResponse, successResponse as photoSuccessResponse } from '../utils.js';
import type { Note } from '@portal/shared';

export const handleGetUserPhotos = async (c: PhotoContext<PhotoAppEnv>) => {
    const user = c.get('user');
    const { created_at, job_id, service_id, invoice_id } = c.req.query();

    try {
        let query = `
            SELECT
                p.id,
                p.url,
                p.created_at,
                p.job_id,
                p.service_id,
                p.invoice_id,
                (SELECT JSON_GROUP_ARRAY(JSON_OBJECT('id', n.id, 'content', n.content, 'created_at', n.created_at))
                 FROM notes n WHERE n.photo_id = p.id) as notes
            FROM photos p
            WHERE p.user_id = ?
        `;
        const queryParams: (string | number)[] = [user.id];

        if (created_at) {
            query += ` AND date(p.created_at) = ?`;
            queryParams.push(created_at);
        }
        if (job_id) {
            query += ` AND p.job_id = ?`;
            queryParams.push(job_id);
        }
        if (service_id) {
            query += ` AND p.service_id = ?`;
            queryParams.push(service_id);
        }
        if (invoice_id) {
            query += ` AND p.invoice_id = ?`;
            queryParams.push(invoice_id);
        }

        query += ` ORDER BY p.created_at DESC`;

        const { results } = await c.env.DB.prepare(query).bind(...queryParams).all();

        // The 'notes' column will be a JSON string, so we need to parse it.
        const photos = results.map((photo: any) => ({
            ...photo,
            // FIX: Add an explicit type for the 'n' parameter to resolve the TS7006 error.
            notes: photo.notes ? JSON.parse(photo.notes).filter((n: Note) => n.id !== null) : [],
        }));


        return photoSuccessResponse(photos);
    } catch (e: any) {
        console.error("Failed to get user photos:", e.message);
        return photoErrorResponse("Failed to retrieve photos", 500);
    }
};


export const handleGetPhotosForJob = async (c: PhotoContext<PhotoAppEnv>) => {
    const { jobId } = c.req.param();
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM photos WHERE job_id = ? ORDER BY created_at DESC`
        ).bind(jobId).all();
        return photoSuccessResponse(results);
    } catch (e: any) {
        console.error("Failed to get photos:", e.message);
        return photoErrorResponse("Failed to retrieve photos", 500);
    }
};

export const handleAdminUploadPhoto = async (c: PhotoContext<PhotoAppEnv>) => {
    const { jobId } = c.req.param();
    const formData = await c.req.formData();
    const fileValue = formData.get('file');

    if (typeof fileValue === 'string' || !fileValue) {
        return photoErrorResponse("No file provided or invalid file type", 400);
    }
    const file: File = fileValue;

    console.log(`Received file "${file.name}" (${file.size} bytes) for job ${jobId}`);
    // In a real application, you would upload this to a service like Cloudflare R2.
    const imageUrl = `https://portal.777.foo/images/${jobId}/${file.name}`;

    try {
        const { results } = await c.env.DB.prepare(
            `INSERT INTO photos (job_id, url) VALUES (?, ?) RETURNING *`
        ).bind(jobId, imageUrl).all();

        if (!results || results.length === 0) {
            return photoErrorResponse("Failed to save photo record after upload", 500);
        }
        return photoSuccessResponse(results[0], 201);
    } catch (e: any) {
        console.error("Failed to save photo record:", e.message);
        return photoErrorResponse("Failed to save photo record", 500);
    }
};
