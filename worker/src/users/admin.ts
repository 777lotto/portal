// worker/src/users/admin.ts

import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { eq, inArray, like, count, desc, and } from 'drizzle-orm';
import { db } from '../../db/client';
import { users, jobs, notes, photos, calendarEvents } from '../../db/schema';
import { getStripe, createStripeCustomer } from '../../stripe';
import { AdminCreateUserSchema, PaginationSearchQuerySchema } from '@portal/shared';
import type { AppEnv } from '../../index';

const factory = createFactory<AppEnv>();

// This utility function for address validation is preserved as it contains specific business logic.
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


/**
 * REFACTORED: Retrieves a paginated list of users with search capabilities.
 * - Uses zValidator for robust query parameter validation.
 * - Constructs a dynamic Drizzle query for filtering.
 */
export const listUsers = factory.createHandlers(
    zValidator('query', PaginationSearchQuerySchema),
    async (c) => {
        const { page, limit, search } = c.req.valid('query');
        const offset = (page - 1) * limit;
        const database = db(c.env.DB);

        const whereClauses = search ? [like(users.name, `%${search}%`)] : [];

        const userQuery = database.select().from(users).where(and(...whereClauses)).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
        const totalQuery = database.select({ value: count() }).from(users).where(and(...whereClauses));

        const [userResults, totalResults] = await Promise.all([userQuery, totalQuery]);

        const totalUsers = totalResults[0].value;
        const totalPages = Math.ceil(totalUsers / limit);

        return c.json({
            users: userResults,
            totalPages,
            currentPage: page,
            totalUsers,
        });
    }
);

/**
 * REFACTORED: Retrieves a single user by their ID.
 * - Simplified to a single, clean Drizzle query.
 */
export const getUserById = factory.createHandlers(async (c) => {
	const id = parseInt(c.req.param('id'), 10);
	const database = db(c.env.DB);
	const user = await database.query.users.findFirst({ where: eq(users.id, id) });

	if (!user) {
		throw new HTTPException(404, { message: 'User not found' });
	}
	return c.json({ user });
});

/**
 * REFACTORED: Creates a new user with validation.
 * - Uses zValidator to ensure the incoming JSON payload matches the AdminCreateUserSchema.
 * - Business logic for address validation and Stripe customer creation is preserved.
 */
export const createUser = factory.createHandlers(
    zValidator('json', AdminCreateUserSchema),
    async (c) => {
        const validatedUser = c.req.valid('json');
        const database = db(c.env.DB);

        let validatedAddress: string | null | undefined = validatedUser.address;
        if (validatedUser.address) {
            validatedAddress = await getValidatedAddress(validatedUser.address, c.env.GOOGLE_API_KEY);
            if (validatedAddress === null) {
                throw new HTTPException(400, { message: 'The provided address is invalid.' });
            }
        }

        const stripe = getStripe(c.env);
        const stripeCustomer = await createStripeCustomer(stripe, {
            email: validatedUser.email,
            name: validatedUser.name,
            phone: validatedUser.phone,
        });
        if (!stripeCustomer) {
            throw new HTTPException(500, { message: 'Failed to create Stripe customer.' });
        }

        const [newUser] = await database
            .insert(users)
            .values({
                ...validatedUser,
                address: validatedAddress,
                stripeCustomerId: stripeCustomer.id,
            })
            .returning();

        return c.json({ user: newUser }, 201);
    }
);

/**
 * REFACTORED: Updates an existing user.
 * - Uses zValidator to validate the payload. The schema is partial() to allow updating only some fields.
 */
export const updateUser = factory.createHandlers(
    zValidator('json', AdminCreateUserSchema.partial()),
    async (c) => {
        const id = parseInt(c.req.param('id'), 10);
        const validatedData = c.req.valid('json');
        const database = db(c.env.DB);

        const [updatedUser] = await database
            .update(users)
            .set(validatedData)
            .where(eq(users.id, id))
            .returning();

        if (!updatedUser) {
            throw new HTTPException(404, { message: 'User not found to update.' });
        }

        return c.json({ user: updatedUser });
    }
);

/**
 * REFACTORED: Deletes a user and all their associated data.
 * - Logic remains the same but benefits from the global error handler.
 * - Uses a Drizzle transaction to ensure atomicity.
 */
export const deleteUser = factory.createHandlers(async (c) => {
	const id = parseInt(c.req.param('id'), 10);
	const database = db(c.env.DB);

	await database.transaction(async (tx) => {
		const userJobs = await tx.query.jobs.findMany({ where: eq(jobs.userId, id.toString()), columns: { id: true } });
		const jobIds = userJobs.map((j) => j.id);

		if (jobIds.length > 0) {
			await tx.delete(notes).where(inArray(notes.jobId, jobIds));
			await tx.delete(photos).where(inArray(photos.jobId, jobIds));
		}

		await tx.delete(jobs).where(eq(jobs.userId, id.toString()));
		await tx.delete(calendarEvents).where(eq(calendarEvents.userId, id));
		await tx.delete(users).where(eq(users.id, id));
	});

	return c.json({ success: true, message: `User ${id} deleted successfully.` });
});
