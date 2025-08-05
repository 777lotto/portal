import { db } from '../../db/client';
import * as schema from '../../db/schema';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { Hono } from 'hono';
import type { AppEnv } from '../../server';

const app = new Hono<AppEnv>();

export const getUser = async (c: any) => {
    const auth = c.get('clerkUser');
	if (!auth?.id) {
		throw new HTTPException(401, { message: 'Unauthorized' });
	}
	const database = db(c.env.DB);
	const user = await database.query.users.findFirst({
        where: eq(schema.users.id, auth.id)
    });
	if (!user) {
		throw new HTTPException(401, { message: 'User not found.' });
	}
	return user;
}
