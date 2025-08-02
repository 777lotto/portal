import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { db } from '../../../db';
import { notes, jobs, users } from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { User } from '@portal/shared';

const factory = createFactory();

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
                           NOTE HANDLERS
   ======================================================================== */

/**
 * Retrieves all notes for a specific job.
 * Ensures the user is either an admin or the owner of the job.
 */
export const getNotes = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const { jobId } = c.req.param();
	const database = db(c.env.DB);

	// 1. Verify ownership or admin status for the job
	const job = await database.select({ user_id: jobs.user_id }).from(jobs).where(eq(jobs.id, jobId)).get();
	if (!job) {
		throw new HTTPException(404, { message: 'Job not found' });
	}
	if (user.role !== 'admin' && job.user_id !== user.id.toString()) {
		throw new HTTPException(403, { message: 'Access denied' });
	}

	// 2. Fetch notes for the job
	const jobNotes = await database.select().from(notes).where(eq(notes.job_id, jobId)).orderBy(desc(notes.createdAt)).all();

	return c.json({ notes: jobNotes });
});

/**
 * Adds a new note for a job or photo.
 * Can be used by both admins and customers.
 */
export const addNote = factory.createHandlers(userMiddleware, async (c) => {
	const user = c.get('user');
	const validatedData = c.req.valid('json'); // Assumes a Zod schema is used on the route
	const { content, job_id, photo_id } = validatedData;
	const database = db(c.env.DB);

	// Security Check: Ensure the user has permission to add a note to this job/photo
	if (job_id && user.role !== 'admin') {
		const job = await database.select({ user_id: jobs.user_id }).from(jobs).where(eq(jobs.id, job_id)).get();
		if (!job || job.user_id !== user.id.toString()) {
			throw new HTTPException(403, { message: 'You do not have permission to add a note to this job.' });
		}
	}
	// A similar check could be added for photo_id if necessary

	const [newNote] = await database
		.insert(notes)
		.values({
			user_id: user.id,
			content,
			job_id,
			photo_id,
		})
		.returning();

	return c.json({ note: newNote }, 201);
});
