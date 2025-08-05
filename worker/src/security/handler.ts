// worker/src/security/handler.ts
import { createFactory } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { eq, or } from 'drizzle-orm';
import * as schema from '../db/schema';
import { User } from '@portal/shared';
import { createJwtToken, createPasswordSetToken, hashPassword, verifyPassword } from './auth';
import { getStripe, createStripeCustomer } from '../stripe';
import type { AppEnv } from '../server';
import { db } from '../db/client';
import { deleteCookie } from 'hono/cookie';

const factory = createFactory<AppEnv>();

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

export const handleInitializeSignup = factory.createHandlers(async (c) => {
    const { name, email, companyName, phone } = await c.req.json();
    const lowercasedEmail = email?.toLowerCase();
    const cleanedPhone = phone?.replace(/\D/g, '');
    const database = db(c.env.DB);

    try {
        const [newUser] = await database
            .insert(schema.users)
            .values({ name, email: lowercasedEmail, companyName, phone: cleanedPhone, role: 'guest' })
            .returning({ id: schema.users.id, email: schema.users.email, phone: schema.users.phone });

        if (!newUser) {
            throw new HTTPException(500, { message: 'Failed to initialize account.' });
        }

        return c.json({
            userId: newUser.id,
            email: newUser.email,
            phone: newUser.phone
        });
    } catch (e: any) {
        if (e.message?.includes('UNIQUE constraint failed')) {
            throw new HTTPException(409, { message: 'An account with this email or phone number already exists.' });
        }
        throw e;
    }
});

export const handleCheckUser = factory.createHandlers(async (c) => {
    const { identifier } = await c.req.json();
    const lowercasedIdentifier = identifier.toLowerCase();
    const database = db(c.env.DB);

    const user = await database.query.users.findFirst({
        where: or(eq(schema.users.email, lowercasedIdentifier), eq(schema.users.phone, identifier)),
        columns: { email: true, phone: true, passwordHash: true }
    });

    if (!user) {
        return c.json({ status: 'NEW' });
    }

    return c.json({
        status: user.passwordHash ? 'EXISTING_WITH_PASSWORD' : 'EXISTING_NO_PASSWORD',
        email: user.email,
        phone: user.phone,
    });
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

export const handleVerifyResetCode = factory.createHandlers(async (c) => {
    const { identifier, code } = await c.req.json();
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

    const passwordSetToken = await createPasswordSetToken(user.id, c.env.JWT_SECRET);

    return c.json({ passwordSetToken });
});

export const handleSetPassword = factory.createHandlers(async (c) => {
    const { password } = await c.req.json();
    const userToUpdate = c.get('user');
    const database = db(c.env.DB);

    const hashedPassword = await hashPassword(password);

    const currentUser = await database.query.users.findFirst({
        where: eq(schema.users.id, userToUpdate.id),
        columns: { role: true, stripeCustomerId: true }
    });

    const isNewUserSignup = currentUser?.role === 'guest';

    await database
        .update(schema.users)
        .set({
            passwordHash: hashedPassword,
            ...(isNewUserSignup && { role: 'customer' })
        })
        .where(eq(schema.users.id, userToUpdate.id));

    const user = await database.query.users.findFirst({
        where: eq(schema.users.id, userToUpdate.id),
    });

    if (!user) {
        throw new HTTPException(500, { message: 'Could not find user after password update.' });
    }

    if (isNewUserSignup) {
        if (!user.stripeCustomerId) {
            const stripe = getStripe(c.env);
            const customer = await createStripeCustomer(stripe, user as User);
            await database
                .update(schema.users)
                .set({ stripeCustomerId: customer.id })
                .where(eq(schema.users.id, user.id));
            user.stripeCustomerId = customer.id;
        }

        await c.env.NOTIFICATION_QUEUE.send({
            type: 'welcome',
            userId: user.id,
            data: { name: user.name },
            channels: ['email', 'sms'],
        });
    }

    const { passwordHash, ...userWithoutPassword } = user;
    const token = await createJwtToken(userWithoutPassword as User, c.env.JWT_SECRET);
    return c.json({ token, user: userWithoutPassword });
});


export const handleGetUserFromResetToken = factory.createHandlers(async (c) => {
    const { token } = c.req.query();
    if (!token) {
        throw new HTTPException(400, { message: 'Invalid or missing token.' });
    }
    const database = db(c.env.DB);

    const tokenRecord = await database.query.passwordResetTokens.findFirst({
        where: eq(schema.passwordResetTokens.token, token)
    });

    if (!tokenRecord || new Date(tokenRecord.due) < new Date()) {
        throw new HTTPException(400, { message: 'This password reset link is invalid or has expired.' });
    }

    const user = await database.query.users.findFirst({
        where: eq(schema.users.id, tokenRecord.userId),
        columns: { name: true, email: true, phone: true }
    });

    if (!user) {
        throw new HTTPException(404, { message: 'User not found.' });
    }
    return c.json(user);
});

export const handleLoginWithToken = factory.createHandlers(async (c) => {
    const userToLogin = c.get('user');
    const database = db(c.env.DB);

    const user = await database.query.users.findFirst({
        where: eq(schema.users.id, userToLogin.id),
    });

    if (!user) {
        throw new HTTPException(404, { message: 'User for this token not found.' });
    }

    const { passwordHash, ...userWithoutPassword } = user;
    const token = await createJwtToken(userWithoutPassword as User, c.env.JWT_SECRET);
    return c.json({ token, user: userWithoutPassword });
});


export const handleLogout = factory.createHandlers(async (c) => {
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ message: "Logged out successfully" });
});
