// worker/src/handlers/availability.ts
import { Context } from 'hono';
import { AppEnv } from '../../index.js';
import { successResponse, errorResponse } from '../../utils.js';

export const handleGetCustomerAvailability = async (c: Context<AppEnv>) => {
  const user = c.get('user');

  try {
    // Query has been updated to use `calendar_events` as the source of truth for scheduling.
    // It fetches all of a user's job events and any globally blocked-off days.
    // It joins with the `jobs` table to get the status for job-related events.
    const dbResponse = await c.env.DB.prepare(
      `SELECT
        ce.start,
        ce.type,
        j.status
      FROM calendar_events ce
      LEFT JOIN jobs j ON ce.job_id = j.id
      WHERE
        (ce.user_id = ? AND ce.type = 'job') OR ce.type = 'blocked'`
    ).bind(user.id).all<{ start: string; type: 'job' | 'blocked' | 'personal'; status: string | null }>();

    const events = dbResponse?.results || [];

    const bookedDays = new Set<string>();
    const pendingDays = new Set<string>();
    const blockedDates = new Set<string>();

    events.forEach(event => {
        const day = event.start.split('T')[0];

        if (event.type === 'blocked') {
            blockedDates.add(day);
        } else if (event.type === 'job') {
            // Check the status from the joined jobs table.
            if (event.status === 'pending_quote' || event.status === 'quote_sent') {
                pendingDays.add(day);
            } else if (event.status && !['cancelled', 'completed', 'quote_draft', 'invoice_draft'].includes(event.status)) {
                // Any other active job status means the day is booked.
                bookedDays.add(day);
            }
        }
    });

    return successResponse({
        bookedDays: Array.from(bookedDays),
        pendingDays: Array.from(pendingDays),
        blockedDates: Array.from(blockedDates)
    });
  } catch (e: any) {
    console.error("Failed to get customer availability:", e);
    return errorResponse("Failed to retrieve availability", 500);
  }
};
