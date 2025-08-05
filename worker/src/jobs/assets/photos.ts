import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db/client.js';
import * as schema from '../../db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import type { PhotoWithNotes } from '@portal/shared';
import type { AppEnv } from '../../server.js';
import { DrizzleD1Database } from 'drizzle-orm/d1';

const factory = createFactory<AppEnv>();

// Define the type for the Cloudflare Images API response for clarity
interface CloudflareImageResponse {
	success: boolean;
	errors: { code: number; message: string }[];
	result?: {
		id: string;
		variants: string[];
	};
}

/* ========================================================================
                           PHOTO HANDLERS
   ======================================================================== */

/**
 * Retrieves photos for a specific job, ensuring the user has permission to view them.
 */
export const getPhotos = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const { jobId } = c.req.param();
	const database = db(c.env.DB);

	// 1. Verify ownership or admin status for the job
	const job = await database.query.jobs.findFirst({ where: eq(schema.jobs.id, jobId) });
	if (!job) {
		throw new HTTPException(404, { message: 'Job not found' });
	}
	if (user.role !== 'admin' && job.userId !== user.id.toString()) {
		throw new HTTPException(403, { message: 'Access denied' });
	}

	// 2. Fetch photos for the job
	const jobPhotos = await database.query.photos.findMany({ where: eq(schema.photos.jobId, jobId), orderBy: desc(schema.photos.createdAt) });
	if (jobPhotos.length === 0) {
		return c.json({ photos: [] });
	}

	// 3. Fetch all notes for these photos in a single query
	const photoIds = jobPhotos.map((p: { id: any; }) => p.id);
	const photoNotes = await database.query.notes.findMany({ where: inArray(schema.notes.photoId, photoIds) });

	// 4. Map notes to their respective photos
	const notesMap = new Map<string, any[]>();
	for (const note of photoNotes) {
		if (note.photoId) {
			if (!notesMap.has(note.photoId)) {
				notesMap.set(note.photoId, []);
			}
			notesMap.get(note.photoId)!.push(note);
		}
	}

	const photosWithNotes: PhotoWithNotes[] = jobPhotos.map((photo: { id: string | number; }) => ({
		...photo,
		notes: notesMap.get(photo.id as string) || [],
	}));

	return c.json({ photos: photosWithNotes });
});

/**
 * [ADMIN] Uploads a photo for a user, associating it with a job if specified.
 */
export const uploadPhoto = factory.createHandlers(async (c) => {
	const formData = await c.req.formData();
	const userId = formData.get('user_id') as string | null;
	const file = formData.get('file') as File | null;
	const noteContent = formData.get('notes') as string | null;
	const jobId = formData.get('job_id') as string | null;

	if (!userId || !file) {
		throw new HTTPException(400, { message: 'user_id and a file are required.' });
	}

	// 1. Upload to Cloudflare Images
	const cfUploadData = new FormData();
	cfUploadData.append('file', file);
	cfUploadData.append('metadata', JSON.stringify({ userId, jobId }));

	const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${c.env.CF_IMAGES_ACCOUNT_HASH}/images/v1`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${c.env.CF_IMAGES_API_TOKEN}` },
		body: cfUploadData,
	});

	const cfResult = (await response.json()) as CloudflareImageResponse;

	if (!cfResult.success || !cfResult.result) {
		const errorMessage = cfResult.errors?.[0]?.message || 'Unknown Cloudflare API error';
		throw new HTTPException(502, { message: `Image upload provider failed: ${errorMessage}` });
	}

	// 2. Save photo record and optional note to our database in a transaction
	const database = db(c.env.DB);
	const [newPhoto] = await database.transaction(async (tx: DrizzleD1Database<typeof schema>) => {
		const [insertedPhoto] = await tx
			.insert(schema.photos)
			.values({
				id: cfResult.result!.id,
				url: cfResult.result!.variants[0],
				userId: parseInt(userId, 10),
				jobId: jobId,
			})
			.returning();

		if (noteContent) {
			await tx.insert(schema.notes).values({
				userId: parseInt(userId, 10),
				content: noteContent,
				jobId: jobId,
				photoId: insertedPhoto.id,
			});
		}
		return [insertedPhoto];
	});

	return c.json({ photo: newPhoto }, 201);
});

/**
 * Deletes a photo from both Cloudflare and the local database.
 */
export const deletePhoto = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const { photoId } = c.req.param();
	const database = db(c.env.DB);

	// 1. Verify the photo exists and the user has permission to delete it.
	const photo = await database.query.photos.findFirst({ where: eq(schema.photos.id, photoId) });
	if (!photo) {
		throw new HTTPException(404, { message: 'Photo not found.' });
	}
	// A real implementation might have more complex ownership rules, but for now we assume admins can delete any.
	if (user.role !== 'admin' && photo.userId !== user.id) {
	  throw new HTTPException(403, { message: 'Access denied.' });
	}

	// 2. Delete from Cloudflare Images
	const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${c.env.CF_IMAGES_ACCOUNT_HASH}/images/v1/${photoId}`, {
		method: 'DELETE',
		headers: { Authorization: `Bearer ${c.env.CF_IMAGES_API_TOKEN}` },
	});

	if (!response.ok) {
		// Log the error but don't block DB deletion, as the image might already be gone.
		console.error(`Failed to delete photo ${photoId} from Cloudflare. Status: ${response.status}`);
	}

	// 3. Delete from our database
	await database.delete(schema.photos).where(eq(schema.photos.id, photoId));

	return c.json({ success: true, message: 'Photo deleted successfully.' });
});
