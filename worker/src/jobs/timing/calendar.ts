// worker/src/jobs/timing/calendar.ts

import { Context as HonoContext } from 'hono'; // Add this import
import { v4 as uuidv4 } from 'uuid'; // Add this import
import type { AppEnv as WorkerAppEnv } from '../../index.js'; // Add this import
import { errorResponse, successResponse } from '../../utils.js'; // Add this import
import type { Env, User, Job, CalendarEvent } from "@portal/shared";
import { JobSchema, CalendarEventSchema } from "@portal/shared";


interface JobRecord extends Job {}

// Get jobs for a specific customer
export async function getCustomerJobs(env: Env, user_id: number): Promise<JobRecord[]> {
  const { results } = await env.DB.prepare(
    `SELECT * FROM jobs WHERE user_id = ? ORDER BY createdAt DESC`
  ).bind(user_id).all<JobRecord>();

  return results || [];
}

// Get a specific job by ID
export async function getJob(env: Env, jobId: string, user_id?: number): Promise<JobRecord> {
  const query = user_id
    ? `SELECT * FROM jobs WHERE id = ? AND user_id = ?`
    : `SELECT * FROM jobs WHERE id = ?`;

  const params = user_id
    ? [jobId, user_id]
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
export async function createJob(env: Env, jobData: any, user_id: number): Promise<JobRecord> {
  // Parse and validate job data
  const parsedJob = JobSchema.parse({
    ...jobData,
    id: jobData.id || uuidv4(),
    user_id: user_id,
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
export async function updateJob(env: Env, jobId: string, updateData: any, user_id: number): Promise<JobRecord> {
  // First check if job exists and belongs to customer
  const existingJob = await getJob(env, jobId, user_id);
  if (!existingJob) {
    throw new Error("Job not found or you don't have permission to modify it");
  }

  // Merge existing job with updates
  const updatedJobData = {
    ...existingJob,
    ...updateData,
    id: jobId, // ensure ID doesn't change
    user_id: user_id, // ensure user ID doesn't change
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
    user_id
  ).run();

  return parsedJob as JobRecord;
}

// Delete a job
export async function deleteJob(env: Env, jobId: string, user_id: number): Promise<{ success: boolean }> {
  const result = await env.DB.prepare(
    `DELETE FROM jobs WHERE id = ? AND user_id = ?`
  ).bind(jobId, user_id).run();

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
    'PRODID:-//777 Solutions LLC//EN',
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

export const handleGetSecretCalendarUrl = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');

    try {
        let tokenRecord = await c.env.DB.prepare(
            `SELECT token FROM calendar_tokens WHERE user_id = ?`
        ).bind(user.id).first<{ token: string }>();

        if (!tokenRecord) {
            const newToken = uuidv4();
            await c.env.DB.prepare(
                `INSERT INTO calendar_tokens (token, user_id) VALUES (?, ?)`
            ).bind(newToken, user.id).run();
            tokenRecord = { token: newToken };
        }

        const url = `${portalBaseUrl}/api/public/calendar/feed/${tokenRecord.token}.ics`;
        return successResponse({ url });

    } catch (e: any) {
        console.error(`Failed to get or create calendar token for user ${user.id}:`, e);
        return errorResponse("Could not retrieve calendar URL.", 500);
    }
};

export const handleRegenerateSecretCalendarUrl = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');

    try {
        await c.env.DB.prepare(
            `DELETE FROM calendar_tokens WHERE user_id = ?`
        ).bind(user.id).run();

        const newToken = uuidv4();
        await c.env.DB.prepare(
            `INSERT INTO calendar_tokens (token, user_id) VALUES (?, ?)`
        ).bind(newToken, user.id).run();

        const url = `${portalBaseUrl}/api/public/calendar/feed/${newToken}.ics`;
        return successResponse({ url });

    } catch (e: any) {
         console.error(`Failed to regenerate calendar token for user ${user.id}:`, e);
        return errorResponse("Could not regenerate calendar URL.", 500);
    }
};

export const handleCalendarFeed = async (c: HonoContext<WorkerAppEnv>) => {
    const user = c.get('user');
    try {
        const icalContent = await generateCalendarFeed(c.env, user.id.toString());
        return new Response(icalContent, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': `attachment; filename="jobs-user-${user.id}.ics"`,
            }
        });
    } catch (e: any) {
        console.error("Failed to generate calendar feed:", e);
        return errorResponse("Could not generate calendar feed.", 500);
    }
};

// --- Admin Handlers for Calendar Events ---

export async function handleGetCalendarEvents(c: HonoContext<WorkerAppEnv>) {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM calendar_events ORDER BY start ASC`
    ).all<CalendarEvent>();
    return successResponse(results || []);
  } catch (e: any) {
    console.error("Error fetching calendar events:", e);
    return errorResponse('Failed to fetch calendar events.', 500);
  }
}

export async function handleAddCalendarEvent(c: HonoContext<WorkerAppEnv>) {
  const user = c.get('user');
  const body = await c.req.json();
  const parsed = CalendarEventSchema.omit({ id: true, user_id: true }).safeParse(body);

  if (!parsed.success) {
    return errorResponse("Invalid data", 400, parsed.error.flatten());
  }

  const { title, start, end, type, job_id } = parsed.data;

  try {
    await c.env.DB.prepare(
      `INSERT INTO calendar_events (title, start, end, type, job_id, user_id) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(title, start, end, type, job_id || null, user.id).run();
    return successResponse({ ...parsed.data, user_id: user.id }, 201);
  } catch (e: any) {
    console.error("Error adding calendar event:", e);
    return errorResponse('Failed to add calendar event.', 500);
  }
}

export async function handleRemoveCalendarEvent(c: HonoContext<WorkerAppEnv>) {
  const { eventId } = c.req.param();

  try {
    const { success } = await c.env.DB.prepare(
      `DELETE FROM calendar_events WHERE id = ?`
    ).bind(eventId).run();

    if (!success) {
      return errorResponse('Failed to remove calendar event.', 500);
    }
    return successResponse({ message: `Calendar event ${eventId} has been removed.` });
  } catch (e: any) {
    console.error("Error removing calendar event:", e);
    return errorResponse('Failed to remove calendar event.', 500);
  }
}
