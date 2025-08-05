import { createFactory } from 'hono/factory';
import { db } from '../../db/client';
import * as schema from '../../db/schema';
import { eq, inArray, desc } from 'drizzle-orm';
import type { AppEnv } from '../../server';

const factory = createFactory<AppEnv>();

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
			id: schema.jobs.id,
			title: schema.jobs.title,
			status: schema.jobs.status,
			updatedAt: schema.jobs.updatedAt,
			customerName: schema.users.name,
		})
		.from(schema.jobs)
		.leftJoin(schema.users, eq(schema.jobs.userId, schema.users.id.toString()))
		.where(inArray(schema.jobs.status, ['quote_draft', 'invoice_draft']))
		.orderBy(desc(schema.jobs.updatedAt))

	return c.json({ drafts: draftJobs });
});
