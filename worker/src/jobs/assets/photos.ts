// 777lotto/portal/portal-fold/worker/src/handlers/photos.ts
import { Context as PhotoContext } from 'hono';
import { AppEnv as PhotoAppEnv } from '../../index.js';
import { errorResponse as photoErrorResponse, successResponse as photoSuccessResponse } from '../../utils.js';
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

export const handleChatAttachmentUpload = async (c: PhotoContext<PhotoAppEnv>) => {
    const user = c.get('user');
    if (!user) {
        return photoErrorResponse('Unauthorized', 401);
    }

    const formData = await c.req.formData();
    const fileValue = formData.get('file');

    // Check if fileValue is a string or null/undefined
    if (typeof fileValue === 'string' || !fileValue) {
        return photoErrorResponse('No file provided or invalid file type.', 400);
    }
    // After the guard, explicitly cast fileValue to File.
    const file: File = fileValue;

    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    const cfAccountId = c.env.CF_IMAGES_ACCOUNT_HASH;
    const cfApiToken = c.env.CF_IMAGES_API_TOKEN;

    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/images/v1`, {
        method: 'POST',
        body: uploadFormData,
        headers: {
            Authorization: `Bearer ${cfApiToken}`,
        },
    });

    const result: CloudflareImageResponse = await response.json();

    if (!result.success || !result.result) {
        console.error('CF Image Upload Error:', result.errors);
        return photoErrorResponse('File upload failed due to an internal error.', 500);
    }

    const publicUrl = result.result.variants.find((v: string) => v.endsWith('/public')) || result.result.variants[0];

    const attachment = {
        url: publicUrl,
        fileName: file.name,
        fileType: file.type,
    };

    return c.json({
        success: true,
        attachment: attachment
    });
};

export const handleGetUserPhotos = async (c: PhotoContext<PhotoAppEnv>) => {
    const user = c.get('user');
    const { createdAt, job_id, item_id } = c.req.query();

    try {
        let query = `
            SELECT
                p.id,
                p.url,
                p.createdAt,
                p.job_id,
                p.item_id,
                (SELECT JSON_GROUP_ARRAY(JSON_OBJECT('id', n.id, 'content', n.content, 'createdAt', n.createdAt))
                 FROM notes n WHERE n.photo_id = p.id) as notes
            FROM photos p
            WHERE p.user_id = ?
        `;
        const queryParams: (string | number)[] = [user.id];

        if (createdAt) {
            query += ` AND date(p.createdAt) = ?`;
            queryParams.push(createdAt);
        }
        if (job_id) {
            query += ` AND p.job_id = ?`;
            queryParams.push(job_id);
        }
        if (item_id) {
            query += ` AND p.item_id = ?`;
            queryParams.push(item_id);
        }

        query += ` ORDER BY p.createdAt DESC`;

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
            `SELECT * FROM photos WHERE job_id = ? ORDER BY createdAt DESC`
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
    const user_id = formData.get('user_id') as string | null;
    const fileValue = formData.get('photo');
    const jobId = formData.get('job_id') as string | null;
    const serviceId = formData.get('item_id') as string | null;
    const notes = formData.get('notes') as string | null;


    if (!user_id) {
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
    cfUploadData.append('metadata', JSON.stringify({ user_id, jobId, serviceId }));


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
            user_id: parseInt(user_id, 10),
            job_id: jobId || null,
            item_id: serviceId ? parseInt(serviceId, 10) : null,
        };

        const { results: dbResults } = await c.env.DB.prepare(
            `INSERT INTO photos (id, url, user_id, job_id, item_id) VALUES (?, ?, ?, ?, ?) RETURNING *`
        ).bind(newPhotoData.id, newPhotoData.url, newPhotoData.user_id, newPhotoData.job_id, newPhotoData.item_id).all<Photo>();

        if (!dbResults || dbResults.length === 0) {
            console.error(`Failed to save photo record for Cloudflare image ${newPhotoData.id}`);
            return photoErrorResponse("Failed to save photo record after successful upload.", 500);
        }

        if (notes) {
            await c.env.DB.prepare(
                `INSERT INTO notes (user_id, content, job_id, item_id, photo_id) VALUES (?, ?, ?, ?, ?)`
            ).bind(newPhotoData.user_id, notes, newPhotoData.job_id, newPhotoData.item_id, newPhotoData.id).run();
        }


        return photoSuccessResponse(dbResults[0], 201);
    } catch (e: any) {
        console.error("Failed to upload photo:", e);
        return photoErrorResponse(e.message || "Failed to upload photo", 500);
    }
};
