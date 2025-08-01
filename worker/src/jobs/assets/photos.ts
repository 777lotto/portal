import { Context } from 'hono';
import { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import type { Photo } from '@portal/shared';

// Define the type for the Cloudflare Images API response
interface CloudflareImageResponse {
	success: boolean;
	errors: { code: number; message: string }[];
	result?: {
		id: string;
		variants: string[];
	};
}

export const handleGetUserPhotos = async (c: Context<AppEnv>) => {
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

		const { results } = await c.env.DB.prepare(query).bind(...queryParams).all<Photo>();

		return successResponse(results);
	} catch (e: any) {
		console.error({ e });
		return errorResponse(e.message, 500);
	}
};

export const handleGetPhotosForJob = async (c: Context<AppEnv>) => {
	const user = c.get('user');
	const { job_id } = c.req.param();

	if (!job_id) {
		return errorResponse('Job ID is required', 400);
	}

	try {
		// First, verify ownership or admin status
		const job = await c.env.DB.prepare(`SELECT user_id FROM jobs WHERE id = ?`).bind(job_id).first<{ user_id: string }>();

		if (!job) {
			return errorResponse('Job not found', 404);
		}

		if (user.role !== 'admin' && job.user_id.toString() !== user.id.toString()) {
			return errorResponse('Access denied', 403);
		}

		const query = `
            SELECT
                p.id,
                p.url,
                p.createdAt,
                p.job_id,
                p.item_id,
                (SELECT JSON_GROUP_ARRAY(JSON_OBJECT('id', n.id, 'content', n.content, 'createdAt', n.createdAt))
                 FROM notes n WHERE n.photo_id = p.id) as notes
            FROM photos p
            WHERE p.job_id = ?
            ORDER BY p.createdAt DESC
        `;
		const { results } = await c.env.DB.prepare(query).bind(job_id).all<Photo>();
		return successResponse(results);
	} catch (e: any) {
		console.error({ e });
		return errorResponse(e.message, 500);
	}
};

export const handleGetPhotoDetails = async (c: Context<AppEnv>) => {
	const user = c.get('user');
	const { id } = c.req.param();

	try {
		const { results } = await c.env.DB.prepare(
			`
            SELECT
                p.id,
                p.url,
                p.createdAt,
                p.job_id,
                p.item_id,
                (SELECT JSON_GROUP_ARRAY(JSON_OBJECT('id', n.id, 'content', n.content, 'createdAt', n.createdAt))
                 FROM notes n WHERE n.photo_id = p.id) as notes
            FROM photos p
            WHERE p.user_id = ? AND p.id = ?
        `
		)
			.bind(user.id, id)
			.all<Photo>();

		if (results.length === 0) {
			return errorResponse('Photo not found', 404);
		}

		return successResponse(results[0]);
	} catch (e: any) {
		console.error({ e });
		return errorResponse(e.message, 500);
	}
};

export const handleAdminUploadPhotoForUser = async (c: Context<AppEnv>) => {
	try {
		const formData = await c.req.formData();
		const user_id = formData.get('user_id') as string | null;
		const file = formData.get('file') as File | null;
		const notes = formData.get('notes') as string | null;
		const jobId = formData.get('job_id') as string | null;
		const lineItemId = formData.get('item_id') as string | null;

		if (!user_id) {
			return errorResponse('user_id is required.', 400);
		}

		if (!file) {
			return errorResponse('A file must be uploaded.', 400);
		}

		const cfUploadData = new FormData();
		cfUploadData.append('file', file);
		cfUploadData.append('metadata', JSON.stringify({ user_id, jobId, lineItemId }));

		const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${c.env.CF_IMAGES_ACCOUNT_HASH}/images/v1`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${c.env.CF_IMAGES_API_TOKEN}`,
			},
			body: cfUploadData,
		});

		const cfResult = (await response.json()) as CloudflareImageResponse;

		if (!cfResult.success) {
			const errorMessage =
				cfResult.errors.length > 0 ? `Cloudflare API Error: ${cfResult.errors[0].message}` : 'Cloudflare API Error: Unknown error';
			throw new Error(errorMessage);
		}

		if (!cfResult.result) {
			throw new Error('Cloudflare API Error: Successful response did not contain result object.');
		}

		const newPhotoData = {
			id: cfResult.result.id,
			url: cfResult.result.variants[0],
			user_id: parseInt(user_id, 10),
			job_id: jobId ? parseInt(jobId, 10) : null,
			item_id: lineItemId ? parseInt(lineItemId, 10) : null,
		};

		const { results: dbResults } = await c.env.DB.prepare(
			`INSERT INTO photos (id, url, user_id, job_id, item_id) VALUES (?, ?, ?, ?, ?) RETURNING *`
		)
			.bind(newPhotoData.id, newPhotoData.url, newPhotoData.user_id, newPhotoData.job_id, newPhotoData.item_id)
			.all<Photo>();

		if (!dbResults || dbResults.length === 0) {
			console.error(`Failed to save photo record for Cloudflare image ${newPhotoData.id}`);
			return errorResponse('Failed to save photo record after successful upload.', 500);
		}

		if (notes) {
			await c.env.DB.prepare(`INSERT INTO notes (user_id, content, job_id, item_id, photo_id) VALUES (?, ?, ?, ?, ?)`).bind(
				newPhotoData.user_id,
				notes,
				newPhotoData.job_id,
				newPhotoData.item_id,
				newPhotoData.id
			).run();
		}

		return successResponse(dbResults[0]);
	} catch (e: any) {
		console.error({ e });
		return errorResponse(e.message, 500);
	}
};

export const handleDeletePhoto = async (c: Context<AppEnv>) => {
	const user = c.get('user');
	const { id } = c.req.param();

	try {
		// First, verify the photo belongs to the user and get its ID
		const photo = await c.env.DB.prepare('SELECT id FROM photos WHERE id = ? AND user_id = ?').bind(id, user.id).first<Photo>();

		if (!photo) {
			return errorResponse('Photo not found or access denied.', 404);
		}

		// Delete from Cloudflare Images
		const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${c.env.CF_IMAGES_ACCOUNT_HASH}/images/v1/${id}`, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${c.env.CF_IMAGES_API_TOKEN}`,
			},
		});

		if (!response.ok) {
			// If it fails, it might be because the image is already gone.
			// Log it, but don't block DB deletion.
			console.error(`Failed to delete photo ${id} from Cloudflare Images.`);
		}

		// Delete from database
		await c.env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(id).run();

		return successResponse({ message: 'Photo deleted successfully.' });
	} catch (e: any) {
		console.error({ e });
		return errorResponse(e.message, 500);
	}
};
