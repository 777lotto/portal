// worker/src/security/handler.ts
import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { eq, or } from 'drizzle-orm';
import * as schema from '../db/schema';
import { User } from '@portal/shared';
import { createJwtToken, hashPassword, verifyPassword } from './auth';
import { getStripe, createStripeCustomer } from '../stripe';
import type { AppEnv } from '../server';
import { db } from '../db/client';

const factory = createFactory<AppEnv>();

// --- REFACTORED: All handlers now use the createFactory pattern ---
// - Manual validation and response helpers have been removed.
// - All database queries now use Drizzle ORM.
// - Logic is simplified and relies on the global error handler.

export const handleLogin = factory.createHandlers(async (c) => {
  const { email, password } = await c.req.json();
  const database = db(c.env.DB);

  const user = await database.query.users.findFirst({
    where: eq(schema.users.email, email.toLowerCase()),
  });

  if (!user || !user.passwordHash) {
    throw new HTTPException(401, { message: 'Invalid email or password.' });
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    throw new HTTPException(401, { message: 'Invalid email or password.' });
  }

  const { passwordHash, ...userWithoutPassword } = user;
  const token = await createJwtToken(userWithoutPassword as User, c.env.JWT_SECRET);
  return c.json({ token, user: userWithoutPassword });
});

export const handleSignup = factory.createHandlers(async (c) => {
    const { name, email, companyName, phone, password } = await c.req.json();
    const lowercasedEmail = email?.toLowerCase();
    const cleanedPhone = phone?.replace(/\D/g, '');
    const hashedPassword = await hashPassword(password);
    const database = db(c.env.DB);

    try {
        const [newUser] = await database
            .insert(schema.users)
            .values({ name, email: lowercasedEmail, companyName, phone: cleanedPhone, role: 'customer', passwordHash: hashedPassword })
            .returning({ id: schema.users.id, email: schema.users.email, phone: schema.users.phone, name: schema.users.name, role: schema.users.role });

        if (!newUser) {
            throw new HTTPException(500, { message: 'Failed to create account.' });
        }

        const stripe = getStripe(c.env);
        const customer = await createStripeCustomer(stripe, newUser as User);
        await database
            .update(schema.users)
            .set({ stripeCustomerId: customer.id })
            .where(eq(schema.users.id, newUser.id));

        await c.env.NOTIFICATION_QUEUE.send({
            type: 'welcome',
            userId: newUser.id,
            data: { name: newUser.name },
            channels: ['email', 'sms'],
        });

        const token = await createJwtToken(newUser as User, c.env.JWT_SECRET);
        return c.json({ token, user: newUser });
    } catch (e: any) {
        if (e.message?.includes('UNIQUE constraint failed')) {
            throw new HTTPException(409, { message: 'An account with this email or phone number already exists.' });
        }
        throw e;
    }
});

export const handleVerifySignup = factory.createHandlers(async (c) => {
    return c.json({ message: "Not implemented" });
});

export const requestPasswordReset = factory.createHandlers(async (c) => {
  const { identifier, channel } = await c.req.json();
  const database = db(c.env.DB);

  const user = await database.query.users.findFirst({
    where: or(eq(schema.users.email, identifier.toLowerCase()), eq(schema.users.phone, identifier)),
    columns: { id: true, name: true, email: true, phone: true },
  });

  if (user) {
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 10);

    await database.insert(schema.passwordResetTokens).values({
      userId: user.id,
      token: token,
      due: expires.toISOString(),
    });

    if (c.env.ENVIRONMENT === 'development') {
      console.log(`\n--- [WORKER] DEV ONLY | Verification Code for ${user.email || user.phone}: ${token} ---\n`);
    }

    await c.env.NOTIFICATION_QUEUE.send({
      type: 'password_reset',
      userId: user.id,
      data: { name: user.name, resetCode: token },
      channels: [channel],
    });
  }

  return c.json({ message: `If an account with that ${channel} exists, a verification code has been sent.` });
});

export const handleResetPassword = factory.createHandlers(async (c) => {
    const { identifier, code, password } = await c.req.json();
    const database = db(c.env.DB);

    const user = await database.query.users.findFirst({
        where: or(eq(schema.users.email, identifier.toLowerCase()), eq(schema.users.phone, identifier)),
        columns: { id: true }
    });

    if (!user) {
        throw new HTTPException(400, { message: 'Invalid code.' });
    }

    const tokenRecord = await database.query.passwordResetTokens.findFirst({
        where: eq(schema.passwordResetTokens.token, code)
    });

    if (!tokenRecord || new Date(tokenRecord.due) < new Date() || tokenRecord.userId !== user.id) {
        if (tokenRecord) {
            await database.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.token, code));
        }
        throw new HTTPException(400, { message: 'This code is invalid or has expired.' });
    }

    await database.delete(schema.passwordResetTokens).where(eq(schema.passwordResetTokens.token, code));

    const hashedPassword = await hashPassword(password);

    await database
        .update(schema.users)
        .set({ passwordHash: hashedPassword })
        .where(eq(schema.users.id, user.id));

    const updatedUser = await database.query.users.findFirst({
        where: eq(schema.users.id, user.id),
    });

    if (!updatedUser) {
        throw new HTTPException(500, { message: 'Could not find user after password update.' });
    }

    const token = await createJwtToken(updatedUser as User, c.env.JWT_SECRET);
    return c.json({ token, user: updatedUser });
});
