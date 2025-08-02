// worker/src/public/index.ts
import { Context } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { AppEnv } from '../index.js';
import { PublicBookingRequestSchema, User } from '@portal/shared';
import { errorResponse, successResponse } from '../utils.js';
import { createJob, generateCalendarFeed } from '../jobs/timing/calendar.js';
import { getStripe } from '../stripe/index.js';

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

export const handlePublicCalendarFeed = async (c: Context<AppEnv>) => {
    const { token } = c.req.param();
    const cleanToken = token.endsWith('.ics') ? token.slice(0, -4) : token;

    if (!cleanToken) {
        return errorResponse("Invalid token.", 400);
    }

    try {
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

export const handleGetAvailability = async (c: Context<AppEnv>) => {
  try {
    const { results: eventResults } = await c.env.DB.prepare(
      `SELECT start FROM calendar_events WHERE type IN ('job', 'blocked')`
    ).all<{ start: string }>();

    const bookedDays = new Set<string>();

    eventResults?.forEach((event: { start: string }) => {
      const day = new Date(event.start).toISOString().split('T')[0];
      bookedDays.add(day);
    });

    return successResponse({ bookedDays: Array.from(bookedDays) });
  } catch (e: any) {
    console.error("Failed to get availability:", e.message, e.stack);
    return errorResponse("Failed to retrieve availability", 500);
  }
};

export const handleCreateBooking = async (c: Context<AppEnv>) => {
  const body = await c.req.json();
  const parsed = PublicBookingRequestSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse("Invalid booking data", 400, parsed.error.flatten());
  }

  // --- UPDATED ---
  // Destructure 'lineItems' instead of 'lines'.
  const { name, email, phone, address, date, lineItems } = parsed.data;
  // --- END UPDATE ---
  const lowercasedEmail = email.toLowerCase();
  const cleanedPhone = phone.replace(/\D/g, '').slice(-10);

  try {
    const existingUser = await c.env.DB.prepare(
      `SELECT id, name, password_hash FROM users WHERE email = ? OR phone = ?`
    ).bind(lowercasedEmail, cleanedPhone).first<User & { password_hash?: string }>();

    if (existingUser) {
        if (existingUser.password_hash) {
            return errorResponse(
                "An account with this email or phone number already exists. Please log in to book.",
                409,
                { code: "LOGIN_REQUIRED" }
            );
        } else {
            const token = uuidv4();
            const expires = new Date();
            expires.setHours(expires.getHours() + 1);

            await c.env.DB.prepare(
                `INSERT INTO password_reset_tokens (user_id, token, due) VALUES (?, ?, ?)`
            ).bind(existingUser.id, token, expires.toISOString()).run();

            const portalBaseUrl = c.env.PORTAL_URL.replace('/dashboard', '');
            const resetLink = `${portalBaseUrl}/set-password?token=${token}`;

            await c.env.NOTIFICATION_QUEUE.send({
                type: 'password_reset',
                user_id: existingUser.id,
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

    const { results } = await c.env.DB.prepare(
        `INSERT INTO users (name, email, phone, address, role) VALUES (?, ?, ?, ?, 'guest') RETURNING id`
      ).bind(name, lowercasedEmail, cleanedPhone, address).all<{ id: number }>();

    if (!results || results.length === 0) {
      return errorResponse('Failed to create guest user', 500);
    }
    const user_id = results[0].id;

    let currentStartTime = new Date(`${date}T09:00:00`);

    // --- UPDATED ---
    // Iterate over 'lineItems' and use 'lineItem' as the variable.
    for (const lineItem of lineItems) {
      // Assuming duration is still a valid property for public booking line items.
      const endTime = new Date(currentStartTime.getTime() + (lineItem.duration || 1) * 60 * 60 * 1000);
      const jobData = {
        // Use 'description' for the title to be consistent.
        title: lineItem.description,
        description: `New booking for ${name}. Address: ${address}`,
        start: currentStartTime.toISOString(),
        end: endTime.toISOString(),
        status: 'pending',
        recurrence: 'none',
      };
      await createJob(c.env, jobData, user_id);
      currentStartTime = endTime;
    }
    // --- END UPDATE ---

    return successResponse({ message: 'Booking request received successfully!' }, 201);

  } catch (e: any) {
    console.error("Booking creation failed:", e);
    return errorResponse("An unexpected error occurred during booking.", 500);
  }
};
