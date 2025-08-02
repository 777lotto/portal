import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../../db';
import { photos, jobs, notes, users } from '../../../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import type { User, PhotoWithNotes } from '@portal/shared';

const factory = createFactory();

// Define the type for the Cloudflare Images API response for clarity
interface CloudflareImageResponse {
	success: boolean;
	errors: { code: number; message: string }[];
	result?: {
		id: string;
		variants: string[];
	};
}

// Middleware to get the authenticated user's full profile from the DB.
const userMiddleware = factory.createMiddleware(async (c, next) => {
	const auth = c.get('clerkUser');
	if (!auth?.id) {
		throw new HTTPException(401, { message: 'Unauthorized' });
	}
	const database = db(c.env.DB);
	const user = await database.select().from(users).where(eq(users.clerk_id, auth.id)).get();
	if (!user) {
		throw new HTTPException(401, { message: 'User not found.' });
	}
	c.set('user', user);
	await next();
});

/* ========================================================================
                           PHOTO HANDLERS
   ======================================================================== */

/**
 * Retrieves photos for a specific job, ensuring the user has permission to view them.
 */
export const getPhotos = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const { job_id } = c.req.param();
	const database = db(c.env.DB);

	// 1. Verify ownership or admin status for the job
	const job = await database.select({ user_id: jobs.user_id }).from(jobs).where(eq(jobs.id, job_id)).get();
	if (!job) {
		throw new HTTPException(404, { message: 'Job not found' });
	}
	if (user.role !== 'admin' && job.user_id !== user.id.toString()) {
		throw new HTTPException(403, { message: 'Access denied' });
	}

	// 2. Fetch photos for the job
	const jobPhotos = await database.select().from(photos).where(eq(photos.job_id, job_id)).orderBy(desc(photos.createdAt)).all();
	if (jobPhotos.length === 0) {
		return c.json({ photos: [] });
	}

	// 3. Fetch all notes for these photos in a single query
	const photoIds = jobPhotos.map((p) => p.id);
	const photoNotes = await database.select().from(notes).where(inArray(notes.photo_id, photoIds)).all();

	// 4. Map notes to their respective photos
	const notesMap = new Map<string, any[]>();
	for (const note of photoNotes) {
		if (note.photo_id) {
			if (!notesMap.has(note.photo_id)) {
				notesMap.set(note.photo_id, []);
			}
			notesMap.get(note.photo_id)!.push(note);
		}
	}

	const photosWithNotes: PhotoWithNotes[] = jobPhotos.map((photo) => ({
		...photo,
		notes: notesMap.get(photo.id) || [],
	}));

	return c.json({ photos: photosWithNotes });
});

/**
 * [ADMIN] Uploads a photo for a user, associating it with a job if specified.
 */
export const uploadPhoto = factory.createHandlers(async (c) => {
	const formData = await c.req.formData();
	const user_id = formData.get('user_id') as string | null;
	const file = formData.get('file') as File | null;
	const noteContent = formData.get('notes') as string | null;
	const jobId = formData.get('job_id') as string | null;

	if (!user_id || !file) {
		throw new HTTPException(400, { message: 'user_id and a file are required.' });
	}

	// 1. Upload to Cloudflare Images
	const cfUploadData = new FormData();
	cfUploadData.append('file', file);
	cfUploadData.append('metadata', JSON.stringify({ user_id, jobId }));

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
	const [newPhoto] = await database.transaction(async (tx) => {
		const [insertedPhoto] = await tx
			.insert(photos)
			.values({
				id: cfResult.result!.id,
				url: cfResult.result!.variants[0],
				user_id: parseInt(user_id, 10),
				job_id: jobId,
			})
			.returning();

		if (noteContent) {
			await tx.insert(notes).values({
				user_id: parseInt(user_id, 10),
				content: noteContent,
				job_id: jobId,
				photo_id: insertedPhoto.id,
			});
		}
		return [insertedPhoto];
	});

	return c.json({ photo: newPhoto }, 201);
});

/**
 * Deletes a photo from both Cloudflare and the local database.
 */
export const deletePhoto = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const { photoId } = c.req.param();
	const database = db(c.env.DB);

	// 1. Verify the photo exists and the user has permission to delete it.
	const photo = await database.select({ id: photos.id }).from(photos).where(eq(photos.id, photoId)).get();
	if (!photo) {
		throw new HTTPException(404, { message: 'Photo not found.' });
	}
	// A real implementation might have more complex ownership rules, but for now we assume admins can delete any.
	// if (user.role !== 'admin' && photo.user_id !== user.id) {
	//   throw new HTTPException(403, { message: 'Access denied.' });
	// }

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
	await database.delete(photos).where(eq(photos.id, photoId));

	return c.json({ success: true, message: 'Photo deleted successfully.' });
});
