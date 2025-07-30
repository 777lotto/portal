// worker/src/calendar.ts

import type { Env, User, Job } from "@portal/shared";
import { v4 as uuidv4 } from 'uuid';
import { JobSchema } from "@portal/shared";


interface JobRecord extends Job {}

// Get jobs for a specific customer
export async function getCustomerJobs(env: Env, userId: number): Promise<JobRecord[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM jobs WHERE user_id = ? ORDER BY createdAt DESC`
  ).bind(userId).all<JobRecord>();

  return results || [];
}

// Get a specific job by ID
export async function getJob(env: Env, jobId: string, userId?: number): Promise<JobRecord> {
  const query = userId
    ? `SELECT * FROM jobs WHERE id = ? AND user_id = ?`
    : `SELECT * FROM jobs WHERE id = ?`;

  const params = userId
    ? [jobId, userId]
    : [jobId];

  const job = await env.DB.prepare(query)
    .bind(...params)
    .first<JobRecord>();

  if (!job) {
    throw new Error("Job not found");
  }

  return job;
}

// Create a new job
export async function createJob(env: Env, jobData: any, userId: number): Promise<JobRecord> {
  // Parse and validate job data
  const parsedJob = JobSchema.parse({
    ...jobData,
    id: jobData.id || uuidv4(),
    user_id: userId,
    createdAt: jobData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Insert into database
  await env.DB.prepare(`
    INSERT INTO jobs (
      id, user_id, title, description, status,
      recurrence, createdAt, updatedAt, due
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).bind(
    parsedJob.id,
    parsedJob.user_id,
    parsedJob.title,
    parsedJob.description || null,
    parsedJob.status,
    parsedJob.recurrence,
    parsedJob.createdAt,
    parsedJob.updatedAt,
    parsedJob.due || null
  ).run();

  return parsedJob as JobRecord;
}

// Update an existing job
export async function updateJob(env: Env, jobId: string, updateData: any, userId: number): Promise<JobRecord> {
  // First check if job exists and belongs to customer
  const existingJob = await getJob(env, jobId, userId);
  if (!existingJob) {
    throw new Error("Job not found or you don't have permission to modify it");
  }

  // Merge existing job with updates
  const updatedJobData = {
    ...existingJob,
    ...updateData,
    id: jobId, // ensure ID doesn't change
    user_id: userId, // ensure user ID doesn't change
    updatedAt: new Date().toISOString() // always update the timestamp
  };

  // Validate the merged job
  const parsedJob = JobSchema.parse(updatedJobData);

  // Update in database
  await env.DB.prepare(`
    UPDATE jobs SET
      title = ?,
      description = ?,
      status = ?,
      recurrence = ?,
      updatedAt = ?,
      due = ?
    WHERE id = ? AND user_id = ?
  `).bind(
    parsedJob.title,
    parsedJob.description || null,
    parsedJob.status,
    parsedJob.recurrence,
    parsedJob.updatedAt,
    parsedJob.due || null,
    jobId,
    userId
  ).run();

  return parsedJob as JobRecord;
}

// Delete a job
export async function deleteJob(env: Env, jobId: string, userId: number): Promise<{ success: boolean }> {
  const result = await env.DB.prepare(
    `DELETE FROM jobs WHERE id = ? AND user_id = ?`
  ).bind(jobId, userId).run();

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

  // 2. Get all calendar events for that user
  const { results: calendarEvents } = await env.DB.prepare(
    `SELECT ce.*, j.title as job_title, j.description as job_description
     FROM calendar_events ce
     LEFT JOIN jobs j ON ce.job_id = j.id
     WHERE ce.user_id = ? AND ce.type = 'job'`
  ).bind(feedOwnerId).all<{
    id: number;
    title: string;
    start: string;
    end: string;
    type: string;
    job_id: string;
    user_id: number;
    job_title: string;
    job_description: string;
  }>();

  // 3. Get the details of the customer for these jobs (which is the same as the feed owner)
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

  for (const event of (calendarEvents || [])) {
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);
    const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '');

    const eventId = `${event.id}-${event.job_id}`.replace(/-/g, '');
    let description = `Status: Confirmed\n\n`;
    let eventUrl = '';

    // Create role-specific content
    if (feedOwner.role === 'admin') {
        description += `Customer: ${customer.name} (${customer.email})\n`;
        description += `View User Profile: ${portalBaseUrl}/admin/users/${customer.id}`;
        eventUrl = `${portalBaseUrl}/admin/users/${customer.id}`;
    } else { // Customer view
        description += `Service Details: ${event.job_description || event.job_title}\n`;
        description += `View Job in Portal: ${portalBaseUrl}/jobs/${event.job_id}`;
        eventUrl = `${portalBaseUrl}/jobs/${event.job_id}`;
    }

    icalContent.push('BEGIN:VEVENT');
    icalContent.push(`UID:${eventId}@portal.777.foo`);
    icalContent.push(`DTSTAMP:${formatDate(new Date())}`);
    icalContent.push(`DTSTART:${formatDate(startDate)}`);
    icalContent.push(`DTEND:${formatDate(endDate)}`);
    icalContent.push(`SUMMARY:${event.job_title}`);
    icalContent.push(`DESCRIPTION:${description}`);
    if (eventUrl) {
        icalContent.push(`URL;VALUE=URI:${eventUrl}`);
    }
    icalContent.push(`STATUS:CONFIRMED`);
    icalContent.push(`SEQUENCE:0`);
    icalContent.push(`TRANSP:OPAQUE`);

    // Add reminder (VALARM) if enabled
    if (feedOwner.calendar_reminders_enabled && feedOwner.calendar_reminder_minutes) {
      icalContent.push('BEGIN:VALARM');
      icalContent.push(`TRIGGER:-PT${feedOwner.calendar_reminder_minutes}M`);
      icalContent.push('ACTION:DISPLAY');
      icalContent.push(`DESCRIPTION:Reminder: ${event.job_title}`);
      icalContent.push('END:VALARM');
    }

    icalContent.push('END:VEVENT');
  }

  icalContent.push('END:VCALENDAR');

  return icalContent.filter(line => line).join('\r\n');
}
