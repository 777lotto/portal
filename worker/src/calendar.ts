// worker/src/calendar.ts - Fixed imports and types
import type { Env } from "@portal/shared";
import { v4 as uuidv4 } from 'uuid';
import { JobSchema } from "@portal/shared/calendar";

interface UserRecord {
  id: number;
  stripe_customer_id?: string;
}

interface JobRecord {
  id: string;
  customerId: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  recurrence: string;
  rrule?: string;
  status: string;
  crewId?: string;
  createdAt: string;
  updatedAt: string;
}

// Get jobs for a specific customer
export async function getCustomerJobs(env: Env, customerId: string): Promise<JobRecord[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM jobs WHERE customerId = ? ORDER BY start DESC`
  ).bind(customerId).all();

  return (results || []) as JobRecord[];
}

// Get a specific job by ID
export async function getJob(env: Env, jobId: string, customerId?: string): Promise<JobRecord> {
  const query = customerId
    ? `SELECT * FROM jobs WHERE id = ? AND customerId = ?`
    : `SELECT * FROM jobs WHERE id = ?`;

  const params = customerId
    ? [jobId, customerId]
    : [jobId];

  const job = await env.DB.prepare(query)
    .bind(...params)
    .first() as JobRecord | null;

  if (!job) {
    throw new Error("Job not found");
  }

  return job;
}

// Create a new job
export async function createJob(env: Env, jobData: any, customerId: string): Promise<JobRecord> {
  // Parse and validate job data
  const parsedJob = JobSchema.parse({
    ...jobData,
    id: jobData.id || uuidv4(),
    customerId,
    createdAt: jobData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Insert into database
  await env.DB.prepare(`
    INSERT INTO jobs (
      id, customerId, title, description, start, end,
      recurrence, rrule, status, crewId, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).bind(
    parsedJob.id,
    parsedJob.customerId,
    parsedJob.title,
    parsedJob.description || null,
    parsedJob.start,
    parsedJob.end,
    parsedJob.recurrence,
    parsedJob.rrule || null,
    parsedJob.status,
    parsedJob.crewId || null,
    parsedJob.createdAt,
    parsedJob.updatedAt
  ).run();

  return parsedJob as JobRecord;
}

// Update an existing job
export async function updateJob(env: Env, jobId: string, updateData: any, customerId: string): Promise<JobRecord> {
  // First check if job exists and belongs to customer
  const existingJob = await getJob(env, jobId, customerId);
  if (!existingJob) {
    throw new Error("Job not found or you don't have permission to modify it");
  }

  // Merge existing job with updates
  const updatedJob = {
    ...existingJob,
    ...updateData,
    id: jobId, // ensure ID doesn't change
    customerId, // ensure customer ID doesn't change
    updatedAt: new Date().toISOString() // always update the timestamp
  };

  // Validate the merged job
  const parsedJob = JobSchema.parse(updatedJob);

  // Update in database
  await env.DB.prepare(`
    UPDATE jobs SET
      title = ?,
      description = ?,
      start = ?,
      end = ?,
      recurrence = ?,
      rrule = ?,
      status = ?,
      crewId = ?,
      updatedAt = ?
    WHERE id = ? AND customerId = ?
  `).bind(
    parsedJob.title,
    parsedJob.description || null,
    parsedJob.start,
    parsedJob.end,
    parsedJob.recurrence,
    parsedJob.rrule || null,
    parsedJob.status,
    parsedJob.crewId || null,
    parsedJob.updatedAt,
    jobId,
    customerId
  ).run();

  return parsedJob as JobRecord;
}

// Delete a job
export async function deleteJob(env: Env, jobId: string, customerId: string): Promise<{ success: boolean }> {
  const result = await env.DB.prepare(
    `DELETE FROM jobs WHERE id = ? AND customerId = ?`
  ).bind(jobId, customerId).run();

  // Check if any rows were affected using the meta property
  if (result.meta.changes === 0) {
    throw new Error("Job not found or you don't have permission to delete it");
  }

  return { success: true };
}

// Generate an iCal feed for a customer's jobs
export async function generateCalendarFeed(env: Env, customerId: string): Promise<string> {
  // Get all active jobs for the customer
  const jobs = await getCustomerJobs(env, customerId);

  // Create iCal content
  let icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gutter Portal//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Gutter Service Appointments',
    'X-WR-TIMEZONE:America/New_York',
  ];

  // Add each job as an event
  for (const job of jobs) {
    if (job.status === 'cancelled') continue; // Skip cancelled jobs

    const startDate = new Date(job.start);
    const endDate = new Date(job.end);

    // Format dates for iCal (YYYYMMDDTHHMMSSZ)
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '');
    };

    const eventId = job.id.replace(/-/g, '');

    icalContent.push(
      'BEGIN:VEVENT',
      `UID:${eventId}@gutterportal.com`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${job.title}`,
      job.description ? `DESCRIPTION:${job.description.replace(/\n/g, '\\n')}` : '',
      `STATUS:${job.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`,
      `SEQUENCE:0`,
      `TRANSP:OPAQUE`,
      'END:VEVENT'
    );
  }

  icalContent.push('END:VCALENDAR');

  // Filter out empty lines and join with CRLF
  return icalContent.filter(line => line).join('\r\n');
}
