// worker/src/handlers/photos.ts
import { Context as PhotoContext } from 'hono';
import { AppEnv as PhotoAppEnv } from '../index.js';
import { errorResponse as photoErrorResponse, successResponse as photoSuccessResponse } from '../utils.js';

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

    // FIX: Replaced `instanceof` with a type check that satisfies TypeScript's strict mode.
    if (typeof fileValue === 'string' || !fileValue) {
        return photoErrorResponse("No file provided or invalid file type", 400);
    }
    const file: File = fileValue;

    console.log(`Received file "${file.name}" (${file.size} bytes) for job ${jobId}`);
    // In a real application, you would upload this to a service like Cloudflare R2.
    const imageUrl = `https://example.com/images/${jobId}/${file.name}`;

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
