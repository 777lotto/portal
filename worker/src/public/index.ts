import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { eq, or } from 'drizzle-orm';
import { getStripe } from '../stripe/index.js';
import type { AppEnv } from '../server';
import { DrizzleD1Database } from 'drizzle-orm/d1';

const factory = createFactory<AppEnv>();

/* ========================================================================
                           PUBLIC-FACING HANDLERS
   ======================================================================== */

/**
 * Allows a customer to accept a Stripe quote via a public link.
 */
export const acceptQuote = factory.createHandlers(async (c) => {
	const { quoteId } = c.req.param();
	const stripe = getStripe(c.env);

	const acceptedQuote = await stripe.quotes.accept(quoteId);

	return c.json({
		quote: {
			id: acceptedQuote.id,
			status: acceptedQuote.status,
		},
	});
});

/**
 * Provides a list of dates that are unavailable for booking.
 */
export const getPublicAvailability = factory.createHandlers(async (c) => {
	const database = db(c.env.DB);

	const events = await database
		.select({ start: schema.calendarEvents.start })
		.from(schema.calendarEvents)
		.where(or(eq(schema.calendarEvents.type, 'job'), eq(schema.calendarEvents.type, 'blocked')));

	const bookedDays = new Set<string>();
	events.forEach((event: { start: string | number | Date; }) => {
		const day = new Date(event.start).toISOString().split('T')[0];
		bookedDays.add(day);
	});

	return c.json({ availability: { bookedDays: Array.from(bookedDays) } });
});

/**
 * Handles a new booking request from a public form.
 * This is a complex handler that:
 * 1. Validates the incoming data (via middleware).
 * 2. Checks if a user already exists.
 * 3. Creates a new guest user if one doesn't exist.
 * 4. Creates the job and associated calendar events in a single transaction.
 * 5. Sends notifications.
 */
export const createPublicBooking = factory.createHandlers(async (c) => {
	const validatedData = await c.req.json();
	const { name, email, phone, address, date, lineItems } = validatedData;
	const database = db(c.env.DB);

	const lowercasedEmail = email.toLowerCase();
	const cleanedPhone = phone.replace(/\D/g, '').slice(-10);

	const existingUser = await database.query.users.findFirst({
        where: or(eq(schema.users.email, lowercasedEmail), eq(schema.users.phone, cleanedPhone))
    });

	if (existingUser) {
		// Handle cases where the user exists but may not have a password
		if (existingUser.passwordHash) {
			throw new HTTPException(409, { message: 'An account with this email or phone number already exists. Please log in to book.' });
		} else {
			// User exists as a guest, send them a password set link
			const token = uuidv4();
			const expires = new Date(Date.now() + 3600 * 1000); // 1 hour from now
			await database.insert(schema.passwordResetTokens).values({ userId: existingUser.id, token, due: expires.toISOString() });

			const resetLink = `${c.env.PORTAL_URL}/set-password?token=${token}`;
			await c.env.NOTIFICATION_QUEUE.send({
				type: 'password_reset',
				user_id: existingUser.id,
				data: { name: existingUser.name, resetLink },
				channels: ['email'],
			});

			throw new HTTPException(409, {
				message: "You already have a guest account. We've sent an email with a link to set your password and complete your registration.",
			});
		}
	}

	// Create new user and job in a transaction
	const { newUser, newJob } = await database.transaction(async (tx: DrizzleD1Database<typeof schema>) => {
		const [insertedUser] = await tx
			.insert(schema.users)
			.values({ name, email: lowercasedEmail, phone: cleanedPhone, address, role: 'guest' })
			.returning();

		let currentStartTime = new Date(`${date}T09:00:00`); // Assuming bookings start at 9 AM
		const jobTitle = lineItems.map((item: any) => item.description).join(', ');
		const description = `New booking for ${name}. Address: ${address}`;

		const [insertedJob] = await tx
			.insert(schema.jobs)
			.values({
				id: uuidv4(),
				userId: insertedUser.id.toString(),
				title: jobTitle,
				description,
				status: 'pending',
				recurrence: 'none',
			})
			.returning();

		const endTime = new Date(currentStartTime.getTime() + (lineItems[0]?.duration || 1) * 3600 * 1000);
		await tx.insert(schema.calendarEvents).values({
			title: jobTitle,
			start: currentStartTime.toISOString(),
			end: endTime.toISOString(),
			type: 'job',
			jobId: insertedJob.id,
			userId: insertedUser.id,
		});

		return { newUser: insertedUser, newJob: insertedJob };
	});

	return c.json({ success: true, message: 'Booking request received successfully!' }, 201);
});
