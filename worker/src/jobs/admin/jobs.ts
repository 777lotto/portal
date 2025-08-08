// worker/src/jobs/admin/jobs.ts

import { Context } from 'hono';
import { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
import type { Job, LineItem, JobWithDetails } from '@portal/shared';
import { CreateJobPayloadSchema } from '@portal/shared';

// This function remains as it was, used for fetching and displaying data.
export async function handleGetAllJobs(c: Context<AppEnv>): Promise<Response> {
  try {
    const dbResponse = await c.env.DB.prepare(
      `SELECT
        j.id, j.title, j.createdAt as start, j.due as end, j.status,
        u.name as userName, u.id as userId
      FROM jobs j
      JOIN users u ON j.user_id = CAST(u.id AS TEXT)
      ORDER BY j.createdAt DESC`
    ).all();
    const jobs = dbResponse?.results || [];
    return successResponse(jobs);
  } catch (e: any) {
    console.error("Error in handleGetAllJobs:", e);
    return errorResponse("Failed to fetch all jobs.", 500);
  }
}


export const handleGetJobsAndQuotes = async (c: Context<AppEnv>) => {
  const db = c.env.DB;
  try {
    const { results: jobs } = await db.prepare(
      `SELECT
         j.*,
         u.name as customerName,
         u.address as customerAddress
       FROM jobs j
       JOIN users u ON j.user_id = CAST(u.id AS TEXT)
       ORDER BY j.createdAt DESC`
    ).all<Job & { customerName: string; customerAddress: string }>();

    if (!jobs) {
      return successResponse([]);
    }

    const jobsWithDetails: JobWithDetails[] = [];

    for (const job of jobs) {
      const { results: lineItems } = await db.prepare(
        `SELECT * FROM line_items WHERE job_id = ?`
      ).bind(job.id).all<LineItem>();

      jobsWithDetails.push({
        ...job,
        // CORRECTED: Changed property from 'lineItems' to 'line_items' to match JobWithDetails type.
        line_items: lineItems || [],
      });
    }

    return successResponse(jobsWithDetails);
  } catch (e: any) {
    console.error("Error in handleGetJobsAndQuotes:", e);
    return errorResponse("Failed to retrieve jobs and quotes.", 500);
  }
};


// CORRECTED: This function now uses the updated Zod schema and correct property names.
export const handleAdminCreateJob = async (c: Context<AppEnv>) => {
  const db = c.env.DB;
  const body = await c.req.json();

  const getStatusForJobType = (jobType: 'quote' | 'job' | 'invoice'): string => {
    switch (jobType) {
      case 'quote': return 'pending';
      case 'job': return 'upcoming';
      case 'invoice': return 'payment_needed';
      default: return 'job_draft';
    }
  };

  const validation = CreateJobPayloadSchema.safeParse(body);
  if (!validation.success) {
    // Use flatten() for a more structured error response
    const errorMessage = validation.error.flatten();
    return errorResponse(JSON.stringify(errorMessage), 400);
  }

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
  } = validation.data;

  try {
    const userIntegerId = parseInt(user_id, 10);
    if (isNaN(userIntegerId)) {
        return errorResponse('Invalid user ID format. Expected a string representing an integer.', 400);
    }

    const newJobId = crypto.randomUUID();

    // CORRECTED: Use 'unit_total_amount_cents' for the calculation.
    const total_amount_cents = lineItems.reduce((sum, item) => sum + (item.unit_total_amount_cents * item.quantity), 0);

    const status = getStatusForJobType(jobType);
    const statements = [];

    statements.push(
      db.prepare(
        `INSERT INTO jobs (id, user_id, title, description, status, recurrence, total_amount_cents, due)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(newJobId, user_id, title, description || null, status, recurrence || null, total_amount_cents, due || null)
    );

    // CORRECTED: Use 'description' and 'unit_total_amount_cents' for the insert.
    for (const item of lineItems) {
      statements.push(
        db.prepare(
          `INSERT INTO line_items (job_id, description, unit_total_amount_cents, quantity) VALUES (?, ?, ?, ?)`
        ).bind(newJobId, item.description, item.unit_total_amount_cents, item.quantity)
      );
    }

    if (start && end) {
      statements.push(
        db.prepare(
          `INSERT INTO calendar_events (title, start, "end", type, job_id, user_id)
           VALUES (?, ?, ?, 'job', ?, ?)`
        ).bind(title, start, end, newJobId, userIntegerId)
      );
    }

    await db.batch(statements);
    try {
	const jobTypeName = jobType.charAt(0).toUpperCase() + jobType.slice(1);
	const message = `A new ${jobTypeName} has been posted to your account.`;
    const link = `/job/${newJobId}`;
	await c.env.DB.prepare(
		`INSERT INTO notifications (user_id, type, message, link, channels, status) VALUES (?, ?, ?, ?, ?, ?)`
	).bind(userIntegerId, `new_${jobType}`, message, link, JSON.stringify(['ui']), 'sent').run();
} catch (e) {
	console.error(`Failed to create UI notification for new ${jobType}`, e);
}

return c.json({ message: 'Job created successfully', jobId: newJobId }, 201);

  } catch (e: any) {
    console.error('Failed to create job:', e);
    return errorResponse('An internal error occurred while creating the job: ' + e.message, 500);
  }
};
