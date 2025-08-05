// worker/src/users/admin.ts

import { createFactory } from 'hono/factory';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import { eq, inArray, like, count, desc, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { getStripe, createStripeCustomer } from '../stripe/index.js';
import { AdminCreateUserSchema, PaginationSearchQuerySchema } from '@portal/shared';
import type { AppEnv } from '../server.js';

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
export const handleAdminGetUsers = factory.createHandlers(
    zValidator('query', PaginationSearchQuerySchema),
    async (c) => {
        const { page, limit, search } = c.req.valid('query');
        const offset = (page - 1) * limit;
        const database = db(c.env.DB);

        const whereClauses = search ? [like(schema.users.name, `%${search}%`)] : [];

        const userQuery = database.select().from(schema.users).where(and(...whereClauses)).orderBy(desc(schema.users.createdAt)).limit(limit).offset(offset);
        const totalQuery = database.select({ value: count() }).from(schema.users).where(and(...whereClauses));

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
export const handleAdminGetUserById = factory.createHandlers(async (c) => {
	const id = parseInt(c.req.param('id'), 10);
	const database = db(c.env.DB);
	const user = await database.query.users.findFirst({ where: eq(schema.users.id, id) });

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
export const handleAdminCreateUser = factory.createHandlers(
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
            .insert(schema.users)
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
export const handleAdminUpdateUser = factory.createHandlers(
    zValidator('json', AdminCreateUserSchema.partial()),
    async (c) => {
        const id = parseInt(c.req.param('id'), 10);
        const validatedData = c.req.valid('json');
        const database = db(c.env.DB);

        const [updatedUser] = await database
            .update(schema.users)
            .set(validatedData)
            .where(eq(schema.users.id, id))
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
export const handleAdminDeleteUser = factory.createHandlers(async (c) => {
	const id = parseInt(c.req.param('id'), 10);
	const database = db(c.env.DB);

	await database.transaction(async (tx) => {
		const userJobs = await tx.query.jobs.findMany({ where: eq(schema.jobs.userId, id.toString()), columns: { id: true } });
		const jobIds = userJobs.map((j) => j.id);

		if (jobIds.length > 0) {
			await tx.delete(schema.notes).where(inArray(schema.notes.jobId, jobIds));
			await tx.delete(schema.photos).where(inArray(schema.photos.jobId, jobIds));
		}

		await tx.delete(schema.jobs).where(eq(schema.jobs.userId, id.toString()));
		await tx.delete(schema.calendarEvents).where(eq(schema.calendarEvents.userId, id));
		await tx.delete(schema.users).where(eq(schema.users.id, id));
	});

	return c.json({ success: true, message: `User ${id} deleted successfully.` });
});

export const handleAdminAddNoteForUser = factory.createHandlers(async (c) => {
    const { userId } = c.req.param();
    const { content } = await c.req.json();
    const database = db(c.env.DB);

    const [newNote] = await database
        .insert(schema.notes)
        .values({
            user_id: parseInt(userId, 10),
            content,
        })
        .returning();

    return c.json({ note: newNote }, 201);
});

export const handleAdminDeleteLineItemFromJob = factory.createHandlers(async (c) => {
    const { lineItemId } = c.req.param();
    const database = db(c.env.DB);

    await database.delete(schema.lineItems).where(eq(schema.lineItems.id, parseInt(lineItemId, 10)));

    return c.json({ success: true });
});
