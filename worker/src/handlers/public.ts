import { Context } from 'hono';
import { AppEnv } from '../index.js';
import { PublicBookingRequestSchema } from '@portal/shared';
import { errorResponse, successResponse } from '../utils.js';
import { createJob } from '../calendar.js';

const WORKING_HOURS_PER_DAY = 8;

// Handler to get day availability
export const handleGetAvailability = async (c: Context<AppEnv>) => {
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT start, end, title FROM jobs WHERE status NOT IN ('cancelled', 'pending_confirmation')`
    ).all<{ start: string, end: string, title: string }>();

    const bookedHours: { [key: string]: number } = {};

    results?.forEach(job => {
      const startDate = new Date(job.start);
      const day = startDate.toISOString().split('T')[0];

      let duration = 0;
      if (job.title.includes('Full Day')) {
        duration = WORKING_HOURS_PER_DAY;
      } else {
        const endDate = new Date(job.end);
        duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      }

      bookedHours[day] = (bookedHours[day] || 0) + duration;
    });

    const unavailableDays = Object.keys(bookedHours).filter(
      day => bookedHours[day] >= WORKING_HOURS_PER_DAY
    );

    return successResponse({ unavailableDays });
  } catch (e: any) {
    console.error("Failed to get availability:", e);
    return errorResponse("Failed to retrieve availability", 500);
  }
};

// Handler to create a new booking from a public user
export const handleCreateBooking = async (c: Context<AppEnv>) => {
  const body = await c.req.json();
  const parsed = PublicBookingRequestSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("Invalid booking data", 400, parsed.error.flatten());
  }

  const { name, email, phone, address, date, services } = parsed.data;
  const lowercasedEmail = email.toLowerCase();

  try {
    // 1. Find or create the user
    let user = await c.env.DB.prepare(
      `SELECT id FROM users WHERE email = ?`
    ).bind(lowercasedEmail).first<{ id: number }>();

    let userId: number;

    if (user) {
      userId = user.id;
      // Optionally update their info if they book again
      await c.env.DB.prepare(
        `UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?`
      ).bind(name, phone, address, userId).run();
    } else {
      const { results } = await c.env.DB.prepare(
        `INSERT INTO users (name, email, phone, address, role) VALUES (?, ?, ?, ?, 'guest') RETURNING id`
      ).bind(name, lowercasedEmail, phone, address).all<{ id: number }>();

      if (!results || results.length === 0) {
        return errorResponse('Failed to create guest user', 500);
      }
      userId = results[0].id;
    }

    // 2. Create the job(s)
    let currentStartTime = new Date(`${date}T09:00:00`); // Assume work day starts at 9 AM

    for (const service of services) {
      const endTime = new Date(currentStartTime.getTime() + service.duration * 60 * 60 * 1000);

      const jobData = {
        title: service.name,
        description: `New booking for ${name}. Address: ${address}`,
        start: currentStartTime.toISOString(),
        end: endTime.toISOString(),
        status: 'pending_confirmation',
        recurrence: 'none',
      };

      await createJob(c.env, jobData, userId.toString());
      currentStartTime = endTime; // Set start time for the next service
    }

    return successResponse({ message: 'Booking request received successfully!' }, 201);

  } catch (e: any) {
    console.error("Booking creation failed:", e);
    return errorResponse("An unexpected error occurred during booking.", 500);
  }
};
