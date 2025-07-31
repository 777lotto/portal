import { Context } from 'hono';
import { AppEnv } from '../../index.js';
import { errorResponse, successResponse } from '../../utils.js';
// Corrected: Using the relative path for imports as required by the build tool.
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
      JOIN users u ON j.user_id = u.id
      ORDER BY j.createdAt DESC`
    ).all();
    const jobs = dbResponse?.results || [];
    return successResponse(jobs);
  } catch (e: any) {
    console.error("Error in handleGetAllJobs:", e);
    return errorResponse("Failed to fetch all jobs.", 500);
  }
}

// This function is corrected to use the right types for LineItem.
export const handleGetJobsAndQuotes = async (c: Context<AppEnv>) => {
  const db = c.env.DB;
  try {
    const { results: jobs } = await db.prepare(
      `SELECT
         j.*,
         u.name as customerName,
         u.address as customerAddress
       FROM jobs j
       JOIN users u ON j.user_id = u.id
       ORDER BY j.createdAt DESC`
    ).all<Job & { customerName: string; customerAddress: string }>();

    if (!jobs) {
      return successResponse([]);
    }

    // Corrected: Explicitly type the result from the database as the full LineItem type
    const { results: lineItems } = await db.prepare(`SELECT * FROM line_items`).all<LineItem>();
    const lineItemsByJobId = new Map<string, LineItem[]>();
    if (lineItems) {
      for (const item of lineItems) {
        // This check is now valid because the LineItem type from the DB includes job_id
        if (item.job_id) {
          if (!lineItemsByJobId.has(item.job_id)) {
            lineItemsByJobId.set(item.job_id, []);
          }
          lineItemsByJobId.get(item.job_id)!.push(item);
        }
      }
    }

    const jobsWithDetails: JobWithDetails[] = jobs.map(job => ({
      ...job,
      line_items: lineItemsByJobId.get(job.id) || []
    }));

    return successResponse(jobsWithDetails);
  } catch (e: any) {
    console.error("Failed to get jobs and quotes:", e);
    return errorResponse("Failed to retrieve job data.", 500);
  }
};


// NEW: This is the main handler for creating a job, replacing all previous logic.
export const handleAdminCreateJob = async (c: Context<AppEnv>) => {
  const db = c.env.DB;
  const body = await c.req.json();

  const getStatusForJobType = (jobType: 'quote' | 'job' | 'invoice'): string => {
    switch (jobType) {
      case 'quote': return 'quote_sent';
      case 'job': return 'scheduled';
      case 'invoice': return 'invoiced';
      default: return 'draft';
    }
  };

  // 1. Validate the incoming payload using our Zod schema
  const validation = CreateJobPayloadSchema.safeParse(body);
  if (!validation.success) {
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

    // 2. Calculate the total amount from the sum of line items with correct types
    const total_amount_cents = lineItems.reduce((sum: number, item: { description: string, unit_total_amount_cents: number }) => sum + item.unit_total_amount_cents, 0);

    const status = getStatusForJobType(jobType);
    const statements = [];

    // Statement to create the main job record
    statements.push(
      db.prepare(
        `INSERT INTO jobs (id, user_id, title, description, status, recurrence, total_amount_cents, due)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(newJobId, user_id, title, description || null, status, recurrence, total_amount_cents, due || null)
    );

    // Statements to create each line item
    for (const item of lineItems) {
  statements.push(
    db.prepare(
      `INSERT INTO line_items (job_id, description, unit_total_amount_cents) VALUES (?, ?, ?)`
    ).bind(newJobId, item.description, item.unit_total_amount_cents)
  );
}

    // Statement to create the calendar event
    if (start && end) {
      statements.push(
        db.prepare(
          `INSERT INTO calendar_events (title, start, "end", type, job_id, user_id)
           VALUES (?, ?, ?, 'job', ?, ?)`
        ).bind(title, start, end, newJobId, userIntegerId)
      );
    }

    await db.batch(statements);
    // Corrected: Use c.json() instead of a custom helper for the response
    return c.json({ message: 'Job created successfully', jobId: newJobId }, 201);

  } catch (e: any) {
    console.error('Failed to create job:', e);
    return errorResponse('An internal error occurred while creating the job: ' + e.message, 500);
  }
};
