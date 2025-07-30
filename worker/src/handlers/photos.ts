// 777lotto/portal/portal-fold/worker/src/handlers/photos.ts
import { Context as PhotoContext } from 'hono';
import { AppEnv as PhotoAppEnv } from '../index.js';
import { errorResponse as photoErrorResponse, successResponse as photoSuccessResponse } from '../utils.js';
import type { Note, Photo } from '@portal/shared';

// Define the type for the Cloudflare Images API response
interface CloudflareImageResponse {
    success: boolean;
    errors: { code: number; message: string }[];
    result?: {
        id: string;
        variants: string[];
    };
}

export const handleGetUserPhotos = async (c: PhotoContext<PhotoAppEnv>) => {
    const user = c.get('user');
    const { created_at, job_id, service_id } = c.req.query();

    try {
        let query = `
            SELECT
                p.id,
                p.url,
                p.created_at,
                p.job_id,
                p.service_id,
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

        query += ` ORDER BY p.created_at DESC`;

        const { results } = await c.env.DB.prepare(query).bind(...queryParams).all();

        const photos = results.map((photo: any) => ({
            ...photo,
            notes: photo.notes ? JSON.parse(photo.notes).filter((n: Note) => n.id !== null) : [],
        }));


        return photoSuccessResponse(photos);
    } catch (e: any) {
        console.error("Failed to get user photos:", e.message);
        return photoErrorResponse("Failed to retrieve photos", 500);
    }
};

export const handleGetPhotosForJob = async (c: PhotoContext<PhotoAppEnv>) => {
    const user = c.get('user');
    const { id: jobId } = c.req.param(); // Correctly destructure 'id' and rename it to 'jobId'
    try {
        // First, get the job to verify ownership or admin status
        const job = await c.env.DB.prepare(
            `SELECT user_id FROM jobs WHERE id = ?`
        ).bind(jobId).first<{ user_id: string }>();

        if (!job) {
            return photoErrorResponse("Job not found", 404);
        }

        if (user.role !== 'admin' && job.user_id !== user.id.toString()) {
            return photoErrorResponse("Access denied", 403);
        }

        const dbResponse = await c.env.DB.prepare(
            `SELECT * FROM photos WHERE job_id = ? ORDER BY created_at DESC`
        ).bind(jobId).all<Photo>();

        const photos = dbResponse?.results || [];
        return photoSuccessResponse(photos);
    } catch (e: any) {
        console.error("Failed to get photos:", e.message);
        return photoErrorResponse("Failed to retrieve photos", 500);
    }
};

export const handleAdminUploadPhotoForUser = async (c: PhotoContext<PhotoAppEnv>) => {
    const formData = await c.req.formData();
    const userId = formData.get('userId') as string | null;
    const fileValue = formData.get('photo');
    const jobId = formData.get('job_id') as string | null;
    const serviceId = formData.get('service_id') as string | null;
    const notes = formData.get('notes') as string | null;


    if (!userId) {
        return photoErrorResponse("User ID is required.", 400);
    }

    if (typeof fileValue === 'string' || !fileValue) {
        return photoErrorResponse("No file provided or invalid file type.", 400);
    }
    const file: File = fileValue;

    if (!c.env.CF_IMAGES_API_TOKEN || !c.env.CF_IMAGES_ACCOUNT_HASH) {
        console.error("Cloudflare Images credentials are not configured.");
        return photoErrorResponse("Image upload service is not configured.", 500);
    }

    const cfUploadData = new FormData();
    cfUploadData.append('file', file);
    cfUploadData.append('requireSignedURLs', 'false');
    cfUploadData.append('metadata', JSON.stringify({ userId, jobId, serviceId }));


    try {
        const cfResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${c.env.CF_IMAGES_ACCOUNT_HASH}/images/v1`, {
            method: 'POST',
            body: cfUploadData,
            headers: {
                'Authorization': `Bearer ${c.env.CF_IMAGES_API_TOKEN}`,
            },
        });

        const cfResult = await cfResponse.json() as CloudflareImageResponse;

        if (!cfResponse.ok || !cfResult.success) {
            const errorMessage = cfResult.errors[0]?.message || `Cloudflare API Error: ${cfResponse.status}`;
            console.error("Cloudflare Images API Error:", cfResult.errors);
            throw new Error(errorMessage);
        }

        if(!cfResult.result) {
            throw new Error('Cloudflare API Error: Successful response did not contain result object.');
        }

        const newPhotoData = {
            id: cfResult.result.id,
            url: cfResult.result.variants[0],
            user_id: parseInt(userId, 10),
            job_id: jobId || null,
            service_id: serviceId ? parseInt(serviceId, 10) : null,
        };

        const { results: dbResults } = await c.env.DB.prepare(
            `INSERT INTO photos (id, url, user_id, job_id, service_id) VALUES (?, ?, ?, ?, ?) RETURNING *`
        ).bind(newPhotoData.id, newPhotoData.url, newPhotoData.user_id, newPhotoData.job_id, newPhotoData.service_id).all<Photo>();

        if (!dbResults || dbResults.length === 0) {
            console.error(`Failed to save photo record for Cloudflare image ${newPhotoData.id}`);
            return photoErrorResponse("Failed to save photo record after successful upload.", 500);
        }

        if (notes) {
            await c.env.DB.prepare(
                `INSERT INTO notes (user_id, content, job_id, service_id, photo_id) VALUES (?, ?, ?, ?, ?)`
            ).bind(newPhotoData.user_id, notes, newPhotoData.job_id, newPhotoData.service_id, newPhotoData.id).run();
        }


        return photoSuccessResponse(dbResults[0], 201);
    } catch (e: any) {
        console.error("Failed to upload photo:", e);
        return photoErrorResponse(e.message || "Failed to upload photo", 500);
    }
};
