// worker/src/jobs/admin/jobs.ts

import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { jobs, users, lineItems as lineItemsSchema, calendarEvents } from '../../db/schema';
import type { AppEnv } from '../../index';
import { CreateJobPayloadSchema, PaginationSearchQuerySchema } from '@portal/shared';

const factory = createFactory<AppEnv>();

/**
 * Get all jobs with pagination and search.
 * REFACTORED: Uses Drizzle ORM for type-safe queries and zValidator for input validation.
 */
export const getAllJobs = factory.createHandlers(
  zValidator('query', PaginationSearchQuerySchema),
  async (c) => {
    const { page, limit, status, search } = c.req.valid('query');
    const offset = (page - 1) * limit;

    const whereClauses = [];
    if (status) {
      whereClauses.push(eq(jobs.status, status));
    }
    if (search) {
      const searchTerm = `%${search}%`;
      whereClauses.push(
        or(ilike(jobs.title, searchTerm), ilike(users.name, searchTerm))
      );
    }

    const jobsQuery = db
      .select({
        id: jobs.id,
        title: jobs.title,
        start: jobs.createdAt,
        end: jobs.due,
        status: jobs.status,
        userName: users.name,
        userId: users.id,
      })
      .from(jobs)
      .leftJoin(users, eq(jobs.userId, users.id))
      .where(and(...whereClauses))
      .orderBy(desc(jobs.createdAt))
      .limit(limit)
      .offset(offset);

    const totalQuery = db
      .select({ total: count() })
      .from(jobs)
      .leftJoin(users, eq(jobs.userId, users.id))
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

    await db.transaction(async (tx) => {
        await tx.insert(jobs).values({
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
            await tx.insert(lineItemsSchema).values(
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
            await tx.insert(calendarEvents).values({
                title,
                start,
                end,
                type: 'job',
                jobId: newJobId,
                userId: userIntegerId,
            });
        }
    });

    const createdJob = await db.query.jobs.findFirst({
        where: eq(jobs.id, newJobId),
        with: {
            lineItems: true,
        }
    });

    return c.json({ job: createdJob }, 201);
  }
);

// TODO: Other handlers (getJobById, updateJob, deleteLineItem) should also be refactored
// to use the factory pattern and Drizzle ORM for consistency.
