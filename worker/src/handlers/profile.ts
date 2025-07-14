// 777lotto/portal/portal-bet/worker/src/handlers/profile.ts
import { Context as ProfileContext } from 'hono';
import { z } from 'zod';
import { AppEnv as ProfileAppEnv } from '../index.js';
import { errorResponse as profileErrorResponse, successResponse as profileSuccessResponse } from '../utils.js';
import { UserSchema, type User } from '@portal/shared';
import { verifyPassword, hashPassword } from '../auth.js';
import { getStripe } from '../stripe.js';

const UpdateProfilePayload = UserSchema.pick({
    name: true,
    email: true,
    phone: true,
    company_name: true,
    email_notifications_enabled: true,
    sms_notifications_enabled: true,
    preferred_contact_method: true
}).partial();

const ChangePasswordPayload = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});


export const handleGetProfile = async (c: ProfileContext<ProfileAppEnv>) => {
  const user = c.get('user');
  // To ensure the client gets the latest data, let's re-fetch from the DB
  const freshUser = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first<User>();
  return profileSuccessResponse(freshUser);
};

export const handleUpdateProfile = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = UpdateProfilePayload.safeParse(body);

    if (!parsed.success) {
        return profileErrorResponse("Invalid data", 400, parsed.error.flatten());
    }

    const { name, email, phone, company_name, email_notifications_enabled, sms_notifications_enabled, preferred_contact_method } = parsed.data;

    try {
        await c.env.DB.prepare(
            `UPDATE users SET name = ?, email = ?, phone = ?, company_name = ?, email_notifications_enabled = ?, sms_notifications_enabled = ?, preferred_contact_method = ? WHERE id = ?`
        ).bind(
            name ?? user.name,
            email ?? user.email,
            phone !== undefined ? phone : user.phone,
            company_name !== undefined ? company_name : user.company_name,
            email_notifications_enabled,
            sms_notifications_enabled,
            preferred_contact_method ?? user.preferred_contact_method,
            user.id
        ).run();

        if (user.stripe_customer_id && (name || company_name)) {
            const stripe = getStripe(c.env);
            await stripe.customers.update(user.stripe_customer_id, {
                name: name,
                // Stripe doesn't have a dedicated company name field, metadata is the standard place
                metadata: { company_name: company_name || '' }
            });
        }

        const updatedUser = { ...user, ...parsed.data };
        return profileSuccessResponse(updatedUser);
    } catch (e: any) {
        if (e.message?.includes('UNIQUE constraint failed')) {
            return profileErrorResponse('That email or phone number is already in use by another account.', 409);
        }
        console.error("Failed to update profile:", e);
        return profileErrorResponse("Failed to update profile", 500);
    }
};


export const handleChangePassword = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = ChangePasswordPayload.safeParse(body);

    if (!parsed.success) {
        return profileErrorResponse("Invalid password data", 400, parsed.error.flatten());
    }

    const { currentPassword, newPassword } = parsed.data;

    const fullUser = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first<{password_hash: string}>();

    if (!fullUser?.password_hash) {
        return profileErrorResponse("User does not have a password set.", 400);
    }

    const isCorrect = await verifyPassword(currentPassword, fullUser.password_hash);

    if (!isCorrect) {
        return profileErrorResponse("Incorrect current password.", 401);
    }

    const newHashedPassword = await hashPassword(newPassword);

    await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .bind(newHashedPassword, user.id)
        .run();

    return profileSuccessResponse({ message: 'Password updated successfully.' });
};
