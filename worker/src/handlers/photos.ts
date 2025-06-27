// worker/src/handlers/photos.ts
// --------------------------------------
import { Context as PhotoContext } from 'hono';
import { AppEnv as PhotoAppEnv } from '../index';
import { errorResponse as photoErrorResponse, successResponse as photoSuccessResponse } from '../utils';

export const handleGetPhotosForJob = async (c: PhotoContext<PhotoAppEnv>) => {
    const { jobId } = c.req.param();
    // Again, an auth check would be needed here for non-admin users.
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
    const file = formData.get('file') as File;

    if (!file) {
        return photoErrorResponse("No file provided", 400);
    }

    // In a real app, you'd upload this to a service like Cloudflare Images or S3
    // For this example, we'll just log it.
    console.log(`Received file "${file.name}" (${file.size} bytes) for job ${jobId}`);

    // Here you would get the public URL from your image service.
    const imageUrl = `https://example.com/images/${jobId}/${file.name}`;

    try {
        const { results } = await c.env.DB.prepare(
            `INSERT INTO photos (job_id, url) VALUES (?, ?) RETURNING *`
        ).bind(jobId, imageUrl).all();
        return photoSuccessResponse(results[0], 201);
    } catch (e: any) {
        console.error("Failed to save photo record:", e.message);
        return photoErrorResponse("Failed to save photo record", 500);
    }
};
