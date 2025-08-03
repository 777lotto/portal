// worker/src/security/handler.ts
import { createFactory } from 'hono/factory';
import { SignJWT } from 'jose';
import { HTTPException } from 'hono/http-exception';
import { deleteCookie } from 'hono/cookie';
import { eq, or } from 'drizzle-orm';
import { users, passwordResetTokens } from '@portal/shared/db/schema';
import { User } from '@portal/shared';
import { createJwtToken, hashPassword, verifyPassword, getJwtSecretKey } from './auth';
import { getStripe, createStripeCustomer } from '../stripe';

const factory = createFactory();

// --- REFACTORED: All handlers now use the createFactory pattern ---
// - Manual validation and response helpers have been removed.
// - All database queries now use Drizzle ORM.
// - Logic is simplified and relies on the global error handler.

export const initializeSignup = factory.createHandlers(async (c) => {
  const { name, email, company_name, phone } = c.req.valid('json');
  const lowercasedEmail = email?.toLowerCase();
  const cleanedPhone = phone?.replace(/\D/g, '');

  try {
    const [newUser] = await c.env.db
      .insert(users)
      .values({ name, email: lowercasedEmail, company_name, phone: cleanedPhone, role: 'guest' })
      .returning({ id: users.id, email: users.email, phone: users.phone });

    if (!newUser) {
      throw new HTTPException(500, { message: 'Failed to initialize account.' });
    }
    return c.json({ user: newUser });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint failed')) {
      throw new HTTPException(409, { message: 'An account with this email or phone number already exists.' });
    }
    throw e;
  }
});

export const checkUser = factory.createHandlers(async (c) => {
  const { identifier } = c.req.valid('json');
  const lowercasedIdentifier = identifier.toLowerCase();

  const user = await c.env.db.query.users.findFirst({
    where: or(eq(users.email, lowercasedIdentifier), eq(users.phone, identifier)),
    columns: { email: true, phone: true, password_hash: true },
  });

  if (!user) {
    return c.json({ status: 'NEW' });
  }

  return c.json({
    status: user.password_hash ? 'EXISTING_WITH_PASSWORD' : 'EXISTING_NO_PASSWORD',
    email: user.email,
    phone: user.phone,
  });
});

export const login = factory.createHandlers(async (c) => {
  const { email, password } = c.req.valid('json');

  const user = await c.env.db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user || !user.password_hash) {
    throw new HTTPException(401, { message: 'Invalid email or password.' });
  }

  const validPassword = await verifyPassword(password, user.password_hash);
  if (!validPassword) {
    throw new HTTPException(401, { message: 'Invalid email or password.' });
  }

  const { password_hash, ...userWithoutPassword } = user;
  const token = await createJwtToken(userWithoutPassword as User, c.env.JWT_SECRET);
  return c.json({ token, user: userWithoutPassword });
});

export const requestPasswordReset = factory.createHandlers(async (c) => {
  const { identifier, channel } = c.req.valid('json');

  const user = await c.env.db.query.users.findFirst({
    where: or(eq(users.email, identifier.toLowerCase()), eq(users.phone, identifier)),
    columns: { id: true, name: true, email: true, phone: true },
  });

  if (user) {
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 10);

    await c.env.db.insert(passwordResetTokens).values({
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

export const verifyResetCode = factory.createHandlers(async (c) => {
    const { identifier, code } = c.req.valid('json');

    const user = await c.env.db.query.users.findFirst({
        where: or(eq(users.email, identifier.toLowerCase()), eq(users.phone, identifier)),
        columns: { id: true }
    });

    if (!user) {
        throw new HTTPException(400, { message: 'Invalid code.' });
    }

    const tokenRecord = await c.env.db.query.passwordResetTokens.findFirst({
        where: eq(passwordResetTokens.token, code)
    });

    if (!tokenRecord || new Date(tokenRecord.due) < new Date() || tokenRecord.userId !== user.id) {
        if (tokenRecord) {
            await c.env.db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, code));
        }
        throw new HTTPException(400, { message: 'This code is invalid or has expired.' });
    }

    await c.env.db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, code));

    const passwordSetToken = await new SignJWT({ purpose: 'password-set' })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(getJwtSecretKey(c.env.JWT_SECRET));

    return c.json({ passwordSetToken });
});


export const setPassword = factory.createHandlers(async (c) => {
  const { password } = c.req.valid('json');
  const userToUpdate = c.get('user');
  const hashedPassword = await hashPassword(password);

  const currentUser = await c.env.db.query.users.findFirst({
      where: eq(users.id, userToUpdate.id),
      columns: { role: true, stripe_customer_id: true }
  });

  const isNewUserSignup = currentUser?.role === 'guest';

  await c.env.db
    .update(users)
    .set({
      password_hash: hashedPassword,
      role: isNewUserSignup ? 'customer' : currentUser?.role,
    })
    .where(eq(users.id, userToUpdate.id));

  const user = await c.env.db.query.users.findFirst({
    where: eq(users.id, userToUpdate.id),
    columns: { password_hash: false }
  });

  if (!user) {
    throw new HTTPException(500, { message: 'Could not find user after password update.' });
  }

  if (isNewUserSignup) {
    if (!user.stripe_customer_id) {
      const stripe = getStripe(c.env);
      const customer = await createStripeCustomer(stripe, user as User);
      await c.env.db
        .update(users)
        .set({ stripe_customer_id: customer.id })
        .where(eq(users.id, user.id));
      user.stripe_customer_id = customer.id;
    }
    await c.env.NOTIFICATION_QUEUE.send({
      type: 'welcome',
      userId: user.id,
      data: { name: user.name },
      channels: ['email', 'sms'],
    });
  }

  const token = await createJwtToken(user as User, c.env.JWT_SECRET);
  return c.json({ token, user });
});

export const logout = factory.createHandlers(async (c) => {
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ message: 'Logged out successfully' });
});
