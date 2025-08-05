import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../db/client.js';
import * as schema from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import type { AppEnv } from '../../server.js';

const factory = createFactory<AppEnv>();

/* ========================================================================
                           NOTE HANDLERS
   ======================================================================== */

/**
 * Retrieves all notes for a specific job.
 * Ensures the user is either an admin or the owner of the job.
 */
export const getNotes = factory.createHandlers(async (c) => {
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

	// 2. Fetch notes for the job
	const jobNotes = await database.query.notes.findMany({ where: eq(schema.notes.jobId, jobId), orderBy: desc(schema.notes.createdAt) });

	return c.json({ notes: jobNotes });
});

/**
 * Adds a new note for a job or photo.
 * Can be used by both admins and customers.
 */
export const addNote = factory.createHandlers(async (c) => {
	const user = await getUser(c);
	const validatedData = await c.req.json();
	const { content, jobId, photoId } = validatedData;
	const database = db(c.env.DB);

	// Security Check: Ensure the user has permission to add a note to this job/photo
	if (jobId && user.role !== 'admin') {
		const job = await database.query.jobs.findFirst({ where: eq(schema.jobs.id, jobId) });
		if (!job || job.userId !== user.id.toString()) {
			throw new HTTPException(403, { message: 'You do not have permission to add a note to this job.' });
		}
	}
	// A similar check could be added for photo_id if necessary

	const [newNote] = await database
		.insert(schema.notes)
		.values({
			userId: user.id,
			content,
			jobId,
			photoId,
		})
		.returning();

	return c.json({ note: newNote }, 201);
});
