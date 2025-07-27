// worker/src/calendar.ts

import type { Env, User } from "@portal/shared";
import { v4 as uuidv4 } from 'uuid';
import { JobSchema } from "@portal/shared";


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

  return (results || []) as unknown as JobRecord[];
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
      recurrence, rrule, status, crewId, createdAt, updatedAt, expires_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
    parsedJob.updatedAt,
    parsedJob.expires_at || null
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
export async function generateCalendarFeed(env: Env, feedOwnerId: string): Promise<string> {
  const portalBaseUrl = env.PORTAL_URL.replace('/dashboard', '');

  // 1. Get the preferences of the user who owns the feed
  const feedOwner = await env.DB.prepare(
    `SELECT * FROM users WHERE id = ?`
  ).bind(feedOwnerId).first<User>();

  if (!feedOwner) {
    throw new Error("User for calendar feed not found.");
  }

  // 2. Get all active jobs for that user
  const { results: jobs } = await env.DB.prepare(
    `SELECT * FROM jobs WHERE customerId = ? AND status != 'cancelled'`
  ).bind(feedOwnerId).all<JobRecord>();

  // 3. Get the details of the customer for these jobs (which is the same as the feed owner)
  // In a more complex system where admins subscribe to customer jobs, this would be different.
  const customer = feedOwner;

  let icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//777 Solutions LLC//Gutter Portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:777 Solutions Appointments for ${customer.name}`,
    'X-WR-TIMEZONE:America/New_York',
  ];

  for (const job of (jobs || [])) {
    const startDate = new Date(job.start);
    const endDate = new Date(job.end);
    const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '');

    const eventId = job.id.replace(/-/g, '');
    let description = `Status: ${job.status}\n\n`;
    let eventUrl = '';

    // Create role-specific content
    if (feedOwner.role === 'admin') {
        description += `Customer: ${customer.name} (${customer.email})\n`;
        description += `View User Profile: ${portalBaseUrl}/admin/users/${customer.id}`;
        eventUrl = `${portalBaseUrl}/admin/users/${customer.id}`;
    } else { // Customer view
        description += `Service Details: ${job.description || job.title}\n`;
        description += `View Job in Portal: ${portalBaseUrl}/jobs/${job.id}`;
        eventUrl = `${portalBaseUrl}/jobs/${job.id}`;
    }

    icalContent.push('BEGIN:VEVENT');
    icalContent.push(`UID:${eventId}@portal.777.foo`);
    icalContent.push(`DTSTAMP:${formatDate(new Date())}`);
    icalContent.push(`DTSTART:${formatDate(startDate)}`);
    icalContent.push(`DTEND:${formatDate(endDate)}`);
    icalContent.push(`SUMMARY:${job.title}`);
    icalContent.push(`DESCRIPTION:${description}`);
    if (eventUrl) {
        icalContent.push(`URL;VALUE=URI:${eventUrl}`);
    }
    icalContent.push(`STATUS:${job.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}`);
    icalContent.push(`SEQUENCE:0`);
    icalContent.push(`TRANSP:OPAQUE`);

    // Add reminder (VALARM) if enabled
    if (feedOwner.calendar_reminders_enabled && feedOwner.calendar_reminder_minutes) {
      icalContent.push('BEGIN:VALARM');
      icalContent.push(`TRIGGER:-PT${feedOwner.calendar_reminder_minutes}M`);
      icalContent.push('ACTION:DISPLAY');
      icalContent.push(`DESCRIPTION:Reminder: ${job.title}`);
      icalContent.push('END:VALARM');
    }

    icalContent.push('END:VEVENT');
  }

  icalContent.push('END:VCALENDAR');

  return icalContent.filter(line => line).join('\r\n');
}