import { createFactory } from 'hono/factory';
import { db } from '../../../db';
import { jobs, users } from '../../../db/schema';
import { eq, inArray, desc } from 'drizzle-orm';

const factory = createFactory();

/* ========================================================================
                           ADMIN DRAFT HANDLER
   ======================================================================== */

/**
 * Retrieves all jobs that are in a draft status ('quote_draft' or 'invoice_draft').
 * This is an admin-only endpoint.
 */
export const getDrafts = factory.createHandlers(async (c) => {
	const database = db(c.env.DB);

	const draftJobs = await database
		.select({
			id: jobs.id,
			title: jobs.title,
			status: jobs.status,
			updatedAt: jobs.updatedAt,
			customerName: users.name,
		})
		.from(jobs)
		.leftJoin(users, eq(jobs.user_id, users.id.toString()))
		.where(inArray(jobs.status, ['quote_draft', 'invoice_draft']))
		.orderBy(desc(jobs.updatedAt))
		.all();

	return c.json({ drafts: draftJobs });
});
