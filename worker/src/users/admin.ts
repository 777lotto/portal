import { createFactory } from 'hono/factory';
import { clerkAuth } from '@hono/clerk-auth';
import { HTTPException } from 'hono/http-exception';
import { eq, sql, inArray, like, count } from 'drizzle-orm';
import { db } from '../../db';
import { users, jobs, lineItems, notes, photos, notifications, calendarEvents } from '../../db/schema';
import type { User, Job, Photo, Note } from '@portal/shared';
import { getStripe, createStripeCustomer } from '../../stripe';
import { z } from 'zod';

const factory = createFactory();

// --- Utility Functions ---

/**
 * Validates an address using the Google Geocoding API.
 * This logic is preserved from your original file.
 * @param address The address string to validate.
 * @param GOOGLE_API_KEY The Google API key.
 * @returns A formatted address string if valid, null if invalid, or the original address on API error.
 */
async function getValidatedAddress(address: string, GOOGLE_API_KEY: string | undefined): Promise<string | null> {
	if (!GOOGLE_API_KEY) {
		console.error('GOOGLE_API_KEY is not configured. Skipping address validation.');
		return address; // Fallback to the original address
	}

	const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;

	try {
		const response = await fetch(url);
		const data: any = await response.json();

		if (data.status === 'OK' && data.results[0]) {
			return data.results[0].formatted_address;
		}
		return null; // Address is invalid
	} catch (e) {
		console.error('Address validation API call failed:', e);
		return address; // Fallback on network error
	}
}

// --- User Handlers ---

export const listUsers = factory.createHandlers(clerkAuth, async (c) => {
	const { page = '1', limit = '10', search = '' } = c.req.query();
	const pageNumber = parseInt(page, 10);
	const limitNumber = parseInt(limit, 10);
	const offset = (pageNumber - 1) * limitNumber;

	const database = db(c.env.DB);

	const searchPattern = `%${search}%`;
	const whereCondition = search ? like(users.name, searchPattern) : undefined;

	try {
		const userList = await database.select().from(users).where(whereCondition).orderBy(users.name).limit(limitNumber).offset(offset).all();

		const totalResult = await database.select({ count: count() }).from(users).where(whereCondition).get();
		const totalUsers = totalResult?.count ?? 0;
		const totalPages = Math.ceil(totalUsers / limitNumber);

		// FIX: Consistently wrap the response
		return c.json({
			users: userList,
			totalPages,
			totalUsers,
			currentPage: pageNumber,
		});
	} catch (e: any) {
		console.error('Error fetching users:', e);
		throw new HTTPException(500, { message: 'Failed to fetch users' });
	}
});

export const addUser = factory.createHandlers(clerkAuth, async (c) => {
	const body = await c.req.json();
	const database = db(c.env.DB);
	const env = c.env;

	let { name, company_name, email, phone, address, role } = body;

	if (!email && !phone) {
		throw new HTTPException(400, { message: 'An email or phone number is required' });
	}

	if (address) {
		const validatedAddress = await getValidatedAddress(address, env.GOOGLE_API_KEY);
		if (validatedAddress) {
			address = validatedAddress;
		} else {
			throw new HTTPException(400, { message: 'The provided service address could not be validated.' });
		}
	}

	try {
		const result = await database
			.insert(users)
			.values({
				name,
				company_name,
				email: email?.toLowerCase(),
				phone: phone?.replace(/\D/g, ''),
				address,
				role,
			})
			.returning()
			.get();

		// Create Stripe customer if applicable
		if (result.email && result.role !== 'admin' && result.role !== 'associate') {
			const stripe = getStripe(env);
			const customer = await createStripeCustomer(stripe, result);
			const updatedUser = await database
				.update(users)
				.set({ stripe_customer_id: customer.id })
				.where(eq(users.id, result.id))
				.returning()
				.get();
			// FIX: Consistently wrap the response
			return c.json({ user: updatedUser }, 201);
		}

		// FIX: Consistently wrap the response
		return c.json({ user: result }, 201);
	} catch (e: any) {
		if (e.message?.includes('UNIQUE constraint failed')) {
			throw new HTTPException(409, { message: 'A user with this email or phone number already exists.' });
		}
		console.error('Failed to create user by admin:', e);
		throw new HTTPException(500, { message: 'Failed to create user.' });
	}
});

export const updateUser = factory.createHandlers(clerkAuth, async (c) => {
	const { id } = c.req.param();
	const body = await c.req.json();
	const database = db(c.env.DB);
	const env = c.env;

	const existingUser = await database.select().from(users).where(eq(users.id, id)).get();
	if (!existingUser) {
		throw new HTTPException(404, { message: 'User not found' });
	}

	let { address } = body;
	if (address && address !== existingUser.address) {
		const validatedAddress = await getValidatedAddress(address, env.GOOGLE_API_KEY);
		if (validatedAddress) {
			body.address = validatedAddress;
		} else {
			throw new HTTPException(400, { message: 'The provided service address could not be validated.' });
		}
	}

	try {
		const updatedUser = await database.update(users).set(body).where(eq(users.id, id)).returning().get();
		// FIX: Consistently wrap the response
		return c.json({ user: updatedUser });
	} catch (e: any) {
		if (e.message?.includes('UNIQUE constraint failed')) {
			throw new HTTPException(409, { message: 'A user with this email or phone number already exists.' });
		}
		console.error(`Failed to update user ${id}:`, e);
		throw new HTTPException(500, { message: 'Failed to update user.' });
	}
});

export const deleteUser = factory.createHandlers(clerkAuth, async (c) => {
	const { id } = c.req.param();
	const database = db(c.env.DB);

	try {
		await database.transaction(async (tx) => {
			const userJobs = await tx.select({ id: jobs.id }).from(jobs).where(eq(jobs.user_id, id)).all();
			const jobIds = userJobs.map((j) => j.id);

			if (jobIds.length > 0) {
				await tx.delete(lineItems).where(inArray(lineItems.job_id, jobIds));
				await tx.delete(jobs).where(eq(jobs.user_id, id));
			}
			await tx.delete(notes).where(eq(notes.user_id, id));
			await tx.delete(photos).where(eq(photos.user_id, id));
			await tx.delete(notifications).where(eq(notifications.user_id, id));
			await tx.delete(calendarEvents).where(eq(calendarEvents.user_id, id));
			await tx.delete(users).where(eq(users.id, id));
		});

		return c.json({ success: true, message: `User ${id} deleted successfully.` });
	} catch (e: any) {
		console.error(`Failed to delete user ${id}:`, e);
		throw new HTTPException(500, { message: 'Failed to delete user.' });
	}
});

export const importGoogleContacts = factory.createHandlers(clerkAuth, async (c) => {
	const { contacts } = await c.req.json();
	const database = db(c.env.DB);

	const contactsSchema = z.array(z.object({
		name: z.string(),
		email: z.string().optional(),
		phone: z.string().optional(),
	}));

	const parsedContacts = contactsSchema.safeParse(contacts);
	if (!parsedContacts.success) {
		throw new HTTPException(400, { message: 'Invalid contacts data' });
	}

	try {
		let importedCount = 0;
		for (const contact of parsedContacts.data) {
			// Basic check to prevent duplicates
			const existing = await database.select().from(users).where(eq(users.email, contact.email || '')).get();
			if (!existing) {
				await database.insert(users).values({
					name: contact.name,
					email: contact.email,
					phone: contact.phone?.replace(/\D/g, ''),
					role: 'customer',
				}).run();
				importedCount++;
			}
		}
		return c.json({ success: true, message: `${importedCount} contacts imported successfully.` });
	} catch (e: any) {
		console.error('Error importing Google contacts:', e);
		throw new HTTPException(500, { message: 'Failed to import contacts.' });
	}
});
