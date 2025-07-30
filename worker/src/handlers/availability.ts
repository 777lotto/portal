// worker/src/handlers/availability.ts
import { Context } from 'hono';
import { AppEnv } from '../index.js';
import { successResponse, errorResponse } from '../utils.js';

export const handleGetCustomerAvailability = async (c: Context<AppEnv>) => {
  const user = c.get('user');

  try {
    // Fetch all jobs for the user that aren't cancelled or drafts
    const { results: jobResults } = await c.env.DB.prepare(
      `SELECT start, status FROM jobs WHERE user_id = ? AND status NOT IN ('cancelled', 'quote_draft', 'invoice_draft')`
    ).bind(user.id).all<{ start: string, status: string }>();

    // Fetch all manually blocked dates
    const { results: blockedDateResults } = await c.env.DB.prepare(
      `SELECT date FROM blocked_dates`
    ).all<{ date: string }>();

    const bookedDays = new Set<string>();
    const pendingDays = new Set<string>();

    jobResults?.forEach((job) => {
      const day = new Date(job.start).toISOString().split('T')[0];
      // Quotes awaiting acceptance are 'pending'
      if (job.status === 'pending_quote') {
        pendingDays.add(day);
      } 
      // All other non-cancelled/draft statuses are considered 'booked'
      else {
        bookedDays.add(day);
      }
    });

    const blockedDates = new Set<string>();
    blockedDateResults?.forEach((blocked) => {
        blockedDates.add(blocked.date);
    });

    // Return the arrays of unique days
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
