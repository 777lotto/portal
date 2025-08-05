// worker/src/jobs/admin/jobs.ts

import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { and, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../db/client';
import * as schema from '../../db/schema';
import type { AppEnv } from '../../server';
import { CreateJobPayloadSchema, PaginationSearchQuerySchema } from '@portal/shared';
import { DrizzleD1Database } from 'drizzle-orm/d1';

const factory = createFactory<AppEnv>();

/**
 * Get all jobs with pagination and search.
 * REFACTORED: Uses Drizzle ORM for type-safe queries and zValidator for input validation.
 */
export const getAllJobs = factory.createHandlers(
  zValidator('query', PaginationSearchQuerySchema),
  async (c) => {
    const { page, limit, status, search } = c.req.valid('query');
    const database = db(c.env.DB);
    const offset = (page - 1) * limit;

    const whereClauses = [];
    if (status) {
      whereClauses.push(eq(schema.jobs.status, status));
    }
    if (search) {
      const searchTerm = `%${search}%`;
      whereClauses.push(
        or(ilike(schema.jobs.title, searchTerm), ilike(schema.users.name, searchTerm))
      );
    }

    const jobsQuery = database
      .select({
        id: schema.jobs.id,
        title: schema.jobs.title,
        start: schema.jobs.createdAt,
        end: schema.jobs.due,
        status: schema.jobs.status,
        userName: schema.users.name,
        userId: schema.users.id,
      })
      .from(schema.jobs)
      .leftJoin(schema.users, eq(schema.jobs.userId, schema.users.id.toString()))
      .where(and(...whereClauses))
      .orderBy(desc(schema.jobs.createdAt))
      .limit(limit)
      .offset(offset);

    const totalQuery = database
      .select({ total: count() })
      .from(schema.jobs)
      .leftJoin(schema.users, eq(schema.jobs.userId, schema.users.id.toString()))
      .where(and(...whereClauses));

    const [jobResults, totalResult] = await Promise.all([
      jobsQuery,
      totalQuery,
    ]);

    const totalRecords = totalResult[0].total;
    const totalPages = Math.ceil(totalRecords / limit);

    return c.json({
      jobs: jobResults,
      totalPages,
      currentPage: page,
      totalUsers: totalRecords, // Note: This might be better named totalJobs
    });
  }
);

/**
 * Create a new job, its line items, and an optional calendar event in a single transaction.
 * REFACTORED: Uses zValidator for robust input validation.
 */
export const createJob = factory.createHandlers(
  zValidator('json', CreateJobPayloadSchema),
  async (c) => {
    const {
      user_id,
      title,
      description,
      lineItems,
      jobType,
      recurrence,
      due,
      start,
      end,
    } = c.req.valid('json');
    const database = db(c.env.DB)

    const getStatusForJobType = (jobType: 'quote' | 'job' | 'invoice'): string => {
        switch (jobType) {
            case 'quote': return 'quote_sent';
            case 'job': return 'scheduled';
            case 'invoice': return 'invoiced';
            default: return 'draft';
        }
    };

    const total_amount_cents = lineItems.reduce(
      (sum, item) => sum + item.unit_total_amount_cents * item.quantity,
      0
    );
    const status = getStatusForJobType(jobType);
    const newJobId = crypto.randomUUID();

    await database.transaction(async (tx: DrizzleD1Database<typeof schema>) => {
        await tx.insert(schema.jobs).values({
            id: newJobId,
            userId: user_id,
            title,
            description,
            status,
            recurrence,
            totalAmountCents: total_amount_cents,
            due,
        });

        if (lineItems.length > 0) {
            await tx.insert(schema.lineItems).values(
                lineItems.map((item) => ({
                    jobId: newJobId,
                    description: item.description,
                    quantity: item.quantity,
                    unitTotalAmountCents: item.unit_total_amount_cents,
                }))
            );
        }

        if (start && end) {
            const userIntegerId = parseInt(user_id, 10);
            await tx.insert(schema.calendarEvents).values({
                title,
                start,
                end,
                type: 'job',
                jobId: newJobId,
                userId: userIntegerId,
            });
        }
    });

    const createdJob = await database.query.jobs.findFirst({
        where: eq(schema.jobs.id, newJobId),
        with: {
            lineItems: true,
        }
    });

    return c.json({ job: createdJob }, 201);
  }
);

// TODO: Other handlers (getJobById, updateJob, deleteLineItem) should also be refactored
// to use the factory pattern and Drizzle ORM for consistency.
