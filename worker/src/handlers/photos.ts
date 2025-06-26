// worker/src/handlers/photos.ts - CORRECTED

import { v4 as uuidv4 } from 'uuid';
import { errorResponse } from '../utils';
import type { AppContext } from '../index';

export async function handleGetPhotosForJob(c: AppContext): Promise<Response> {
  const user = c.get('user');
  const env = c.env;
  const jobId = c.req.param('id');
  try {
    const { results } = await env.DB.prepare(
      "SELECT * FROM photos WHERE job_id = ? AND user_id = ?"
    ).bind(jobId, user.id).all();
    return c.json(results || []);
  } catch (e: any) {
    console.error(`Error fetching photos for job ${jobId}:`, e);
    return errorResponse(e.message, 500);
  }
}

export async function handleAdminUploadPhoto(c: AppContext): Promise<Response> {
  const env = c.env;
  try {
    const targetUserId = c.req.param('userId');
    const formData = await c.req.formData();
    const photoFile = formData.get('photo');
    const jobId = formData.get('job_id') as string | undefined;
    const serviceId = formData.get('service_id') as string | undefined;

    if (!(photoFile instanceof File)) {
      return errorResponse('Photo file is required.', 400);
    }

    const { CF_IMAGES_ACCOUNT_HASH, CF_IMAGES_API_TOKEN } = env;
    if (!CF_IMAGES_ACCOUNT_HASH || !CF_IMAGES_API_TOKEN) {
      console.error("Cloudflare Images credentials not configured.");
      return errorResponse('Image upload service is not configured.', 500);
    }

    const imageFormData = new FormData();
    imageFormData.append('file', photoFile);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_IMAGES_ACCOUNT_HASH}/images/v1`,
      {
        method: 'POST',
        body: imageFormData,
        headers: { 'Authorization': `Bearer ${CF_IMAGES_API_TOKEN}` },
      }
    );

    const imageData: any = await response.json();
    if (!imageData.success) {
      console.error('Cloudflare Images API Error:', imageData.errors);
      return errorResponse('Failed to upload image.', 500);
    }

    const photoId = uuidv4();
    const imageUrl = imageData.result.variants[0];

    await env.DB.prepare(
      `INSERT INTO photos (id, user_id, job_id, service_id, url) VALUES (?, ?, ?, ?, ?)`
    ).bind(photoId, targetUserId, jobId || null, serviceId || null, imageUrl).run();

    return c.json({ id: photoId, url: imageUrl }, 201);

  } catch (e: any) {
    console.error("Error uploading photo:", e);
    return errorResponse('An internal server error occurred', 500);
  }
}

