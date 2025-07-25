// worker/src/handlers/public.ts
import { Context } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { AppEnv } from '../index.js';
import { PublicBookingRequestSchema, User } from '@portal/shared';
import { errorResponse, successResponse } from '../utils.js';
import { createJob, generateCalendarFeed } from '../calendar.js'; // MODIFIED: import generateCalendarFeed
import { validateTurnstileToken } from '../auth.js';
import { getStripe } from '../stripe.js';

export async function handleAcceptQuote(c: Context<AppEnv>) {
    const { quoteId } = c.req.param();
    const stripe = getStripe(c.env);

    try {
        const acceptedQuote = await stripe.quotes.accept(quoteId);
        return successResponse({ message: 'Quote accepted successfully', quoteId: acceptedQuote.id });
    } catch (e: any) {
        console.error(`Failed to accept quote ${quoteId}:`, e);
        return errorResponse(`Failed to accept quote: ${e.message}`, 500);
    }
}


// NEW: Handler for public iCal feed
export const handlePublicCalendarFeed = async (c: Context<AppEnv>) => {
    const { token } = c.req.param();
    const cleanToken = token.endsWith('.ics') ? token.slice(0, -4) : token;

    if (!cleanToken) {
        return errorResponse("Invalid token.", 400);
    }

    try {
        // Find the user associated with this token
        const tokenRecord = await c.env.DB.prepare(
            `SELECT user_id FROM calendar_tokens WHERE token = ?`
        ).bind(cleanToken).first<{ user_id: number }>();

        if (!tokenRecord) {
            return errorResponse("Calendar feed not found.", 404);
        }

        const icalContent = await generateCalendarFeed(c.env, tokenRecord.user_id.toString());
        return new Response(icalContent, {
            headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': `attachment; filename="jobs-user-${tokenRecord.user_id}.ics"`,
            }
        });

    } catch (e: any) {
        console.error("Failed to generate public calendar feed:", e);
        return errorResponse("Could not generate calendar feed.", 500);
    }
}


// Handler to get day availability
export const handleGetAvailability = async (c: Context<AppEnv>) => {
  try {
    // Fetch all jobs that aren't cancelled, drafts, or expired quotes
    const { results: jobResults } = await c.env.DB.prepare(
      `SELECT start FROM jobs WHERE status NOT IN ('cancelled', 'quote_draft', 'invoice_draft', 'quote_expired')`
    ).all<{ start: string }>();

    // Fetch all manually blocked dates
    const { results: blockedDateResults } = await c.env.DB.prepare(
      `SELECT date FROM blocked_dates`
    ).all<{ date: string }>();


    // Use a Set for efficiency to get unique day strings
    const bookedDays = new Set<string>();

    jobResults?.forEach((job: { start: string }) => {
      const day = new Date(job.start).toISOString().split('T')[0];
      bookedDays.add(day);
    });

    // Add manually blocked dates to the set
    blockedDateResults?.forEach((blocked: { date: string }) => {
        bookedDays.add(blocked.date);
    });

    // Return the array of unique booked days
    return successResponse({ bookedDays: Array.from(bookedDays) });
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

  // ADDED: Turnstile validation
  const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';
  const turnstileSuccess = await validateTurnstileToken(parsed.data['cf-turnstile-response'], ip, c.env);
  if (!turnstileSuccess) {
      return errorResponse("Invalid security token. Please try again.", 403);
  }

  const { name, email, phone, address, date, services } = parsed.data;
  const lowercasedEmail = email.toLowerCase();
  const cleanedPhone = phone.replace(/\D/g, '').slice(-10);

  try {
    // 1. Check for an existing user by email OR phone
    const existingUser = await c.env.DB.prepare(
      `SELECT id, name, password_hash FROM users WHERE email = ? OR phone = ?`
    ).bind(lowercasedEmail, cleanedPhone).first<User & { password_hash?: string }>();

    if (existingUser) {
        // Case 1: User exists and has a password. Prompt them to log in.
        if (existingUser.password_hash) {
            return errorResponse(
                "An account with this email or phone number already exists. Please log in to book.",
                409, // Conflict
                { code: "LOGIN_REQUIRED" }
            );
        } else {
            // Case 2: User exists but has no password (is a guest). Send a password set link.
            const token = uuidv4();
            const expires = new Date();
            expires.setHours(expires.getHours() + 1); // Token expires in 1 hour

            await c.env.DB.prepare(
                `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)`
            ).bind(existingUser.id, token, expires.toISOString()).run();

            const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');
            const resetLink = `${portalBaseUrl}/set-password?token=${token}`;

            await c.env.NOTIFICATION_QUEUE.send({
                type: 'password_reset', // This template works for setting a password too
                userId: existingUser.id,
                data: { name: existingUser.name, resetLink: resetLink },
                channels: ['email']
            });

            return errorResponse(
                "You already have a guest account. We've sent an email with a link to set your password and complete your registration.",
                409,
                { code: "PASSWORD_SET_REQUIRED" }
            );
        }
    }

    // Case 3: No user exists. Create a new guest user and proceed with booking.
    const { results } = await c.env.DB.prepare(
        `INSERT INTO users (name, email, phone, address, role) VALUES (?, ?, ?, ?, 'guest') RETURNING id`
      ).bind(name, lowercasedEmail, cleanedPhone, address).all<{ id: number }>();

    if (!results || results.length === 0) {
      return errorResponse('Failed to create guest user', 500);
    }
    const userId = results[0].id;

    // Create the job(s)
    let currentStartTime = new Date(`${date}T09:00:00`);

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
      currentStartTime = endTime;
    }

    return successResponse({ message: 'Booking request received successfully!' }, 201);

  } catch (e: any) {
    console.error("Booking creation failed:", e);
    return errorResponse("An unexpected error occurred during booking.", 500);
  }
};