import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { eq, sql, inArray, like, count, desc } from 'drizzle-orm';
import { db } from '../../db';
import { users, jobs, notes, photos, calendarEvents } from '../../db/schema';
import type { User } from '@portal/shared';
import { getStripe, createStripeCustomer } from '../../stripe';

const factory = createFactory();

// --- Utility Functions (Preserved from original) ---

async function getValidatedAddress(address: string, GOOGLE_API_KEY: string | undefined): Promise<string | null> {
	if (!GOOGLE_API_KEY) {
		console.warn('GOOGLE_API_KEY is not configured. Skipping address validation.');
		return address;
	}
	const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
	try {
		const response = await fetch(url);
		const data: any = await response.json();
		if (data.status === 'OK' && data.results[0]) {
			return data.results[0].formatted_address;
		}
		return null; // Address is invalid
	} catch (error) {
		console.error('Error validating address with Google API:', error);
		return address; // On API error, fallback to original address
	}
}

// --- Route Handlers ---

/**
 * Retrieves a paginated list of users.
 * This handler now relies on the global error handler for any database issues.
 */
export const listUsers = factory.createHandlers(async (c) => {
	const page = parseInt(c.req.query('page') || '1', 10);
	const limit = parseInt(c.req.query('limit') || '10', 10);
	const searchTerm = c.req.query('search') || '';
	const offset = (page - 1) * limit;

	const database = db(c.env.DB);

	// Perform queries to get paginated users and the total count
	const userQuery = database.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
	const totalQuery = database.select({ value: count() }).from(users);

	if (searchTerm) {
		const searchPattern = `%${searchTerm}%`;
		userQuery.where(like(users.name, searchPattern));
		totalQuery.where(like(users.name, searchPattern));
	}

	const [userResults, totalResults] = await Promise.all([userQuery.all(), totalQuery.get()]);

	const totalUsers = totalResults?.value ?? 0;
	const totalPages = Math.ceil(totalUsers / limit);

	return c.json({
		users: userResults,
		totalPages,
		currentPage: page,
		totalUsers,
	});
});

/**
 * Retrieves a single user by their ID.
 */
export const getUserById = factory.createHandlers(async (c) => {
	const id = c.req.param('id');
	const database = db(c.env.DB);

	const user = await database.select().from(users).where(eq(users.id, Number(id))).get();

	if (!user) {
		throw new HTTPException(404, { message: 'User not found' });
	}

	return c.json({ user });
});

/**
 * Creates a new user.
 * REFACTORED: This handler is now incredibly simple.
 * - It uses `c.req.valid('json')` to get the payload, which is guaranteed to be valid by the `zValidator` middleware.
 * - All manual parsing, validation, and try/catch blocks are removed.
 */
export const createUser = factory.createHandlers(async (c) => {
	const validatedUser = c.req.valid('json');
	const database = db(c.env.DB);

	// Address validation logic is preserved
	let validatedAddress: string | null | undefined = validatedUser.address;
	if (validatedUser.address) {
		validatedAddress = await getValidatedAddress(validatedUser.address, c.env.GOOGLE_API_KEY);
		if (validatedAddress === null) {
			throw new HTTPException(400, { message: 'The provided address is invalid.' });
		}
	}

	// Create Stripe customer
	const stripe = getStripe(c.env);
	const stripeCustomer = await createStripeCustomer(stripe, {
		email: validatedUser.email,
		name: validatedUser.name,
		phone: validatedUser.phone,
	});
	if (!stripeCustomer) {
		throw new HTTPException(500, { message: 'Failed to create Stripe customer.' });
	}

	// Insert the new user into the database
	const [newUser] = await database
		.insert(users)
		.values({
			...validatedUser,
			address: validatedAddress,
			stripe_customer_id: stripeCustomer.id,
		})
		.returning();

	return c.json({ user: newUser }, 201);
});

/**
 * Updates an existing user.
 * REFACTORED: Like createUser, this handler is simplified to focus on the business logic.
 * It assumes validation is handled by middleware.
 */
export const updateUser = factory.createHandlers(async (c) => {
	const id = c.req.param('id');
	const validatedData = c.req.valid('json');
	const database = db(c.env.DB);

	const [updatedUser] = await database
		.update(users)
		.set(validatedData)
		.where(eq(users.id, Number(id)))
		.returning();

	if (!updatedUser) {
		throw new HTTPException(404, { message: 'User not found to update.' });
	}

	return c.json({ user: updatedUser });
});

/**
 * Deletes a user and all their associated data.
 * REFACTORED: The try/catch block is removed. The global error handler will
 * catch any exceptions from the database transaction.
 */
export const deleteUser = factory.createHandlers(async (c) => {
	const id = Number(c.req.param('id'));
	const database = db(c.env.DB);

	// Use a transaction to ensure all related data is deleted together
	await database.transaction(async (tx) => {
		const userJobs = await tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.user_id, id.toString())).all();
		const jobIds = userJobs.map((j) => j.id);

		if (jobIds.length > 0) {
			await tx.delete(notes).where(inArray(notes.job_id, jobIds));
			await tx.delete(photos).where(inArray(photos.job_id, jobIds));
		}

		await tx.delete(jobs).where(eq(jobs.user_id, id.toString()));
		await tx.delete(calendarEvents).where(eq(calendarEvents.user_id, id));
		await tx.delete(users).where(eq(users.id, id));
	});

	return c.json({ success: true, message: `User ${id} deleted successfully.` });
});

/**
 * Imports contacts from Google.
 * REFACTORED: Assumes the incoming `contacts` array is validated by middleware.
 */
export const importGoogleContacts = factory.createHandlers(async (c) => {
	const { contacts } = c.req.valid('json');
	const database = db(c.env.DB);

	let importedCount = 0;
	let skippedCount = 0;

	for (const contact of contacts) {
		// Prevent duplicates based on email if it exists
		const existing = contact.email ? await database.select().from(users).where(eq(users.email, contact.email)).get() : null;

		if (!existing) {
			await database.insert(users).values({
				name: contact.name,
				email: contact.email,
				phone: contact.phone?.replace(/\D/g, ''), // Sanitize phone number
				role: 'customer',
			}).run();
			importedCount++;
		} else {
			skippedCount++;
		}
	}

	return c.json({
		success: true,
		message: `Import complete. Added ${importedCount} new contacts, skipped ${skippedCount} duplicates.`,
		importedCount,
		skippedCount,
	});
});
