// 777lotto/portal/portal-bet/worker/src/handlers/profile.ts
import { Context as ProfileContext } from 'hono';
import { z } from 'zod';
import { AppEnv as ProfileAppEnv } from '../index.js';
import { errorResponse as profileErrorResponse, successResponse as profileSuccessResponse } from '../utils.js';
import { UserSchema, type User, type UINotification } from '@portal/shared';
import { verifyPassword, hashPassword } from '../auth.js';
import { getStripe, listPaymentMethods, createSetupIntent } from '../stripe.js';

const UpdateProfilePayload = UserSchema.pick({
    name: true,
    email: true,
    phone: true,
    company_name: true,
    address: true,
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

    const { name, email, phone, company_name, address, email_notifications_enabled, sms_notifications_enabled, preferred_contact_method } = parsed.data;

    try {
        await c.env.DB.prepare(
            `UPDATE users SET name = ?, email = ?, phone = ?, company_name = ?, address = ?, email_notifications_enabled = ?, sms_notifications_enabled = ?, preferred_contact_method = ? WHERE id = ?`
        ).bind(
            name ?? user.name,
            email ?? user.email,
            phone !== undefined ? phone : user.phone,
            company_name !== undefined ? company_name : user.company_name,
            address !== undefined ? address : user.address,
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

export const handleListPaymentMethods = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    if (!user.stripe_customer_id) {
        return profileSuccessResponse([]);
    }
    const stripe = getStripe(c.env);
    const paymentMethods = await listPaymentMethods(stripe, user.stripe_customer_id);
    return profileSuccessResponse(paymentMethods.data);
};

export const handleCreateSetupIntent = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    if (!user.stripe_customer_id) {
        return profileErrorResponse("User is not a Stripe customer", 400);
    }
    const stripe = getStripe(c.env);
    const setupIntent = await createSetupIntent(stripe, user.stripe_customer_id);
    return profileSuccessResponse({ clientSecret: setupIntent.client_secret });
};

export const handleGetNotifications = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    try {
        // NOTE: This assumes a 'ui_notifications' table exists.
        // In a real scenario, a migration would be created for this.
        const { results } = await c.env.DB.prepare(
            `SELECT id, user_id, type, message, link, is_read, createdAt FROM ui_notifications WHERE user_id = ? ORDER BY createdAt DESC LIMIT 20`
        ).bind(user.id).all<UINotification>();
        return profileSuccessResponse(results || []);
    } catch (e: any) {
        console.error("Failed to get notifications:", e);
        // Fallback to empty array if table doesn't exist
        if (e.message.includes('no such table')) {
            return profileSuccessResponse([]);
        }
        return profileErrorResponse("Failed to retrieve notifications", 500);
    }
};

export const handleMarkAllNotificationsRead = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    try {
        // NOTE: This assumes a 'ui_notifications' table exists.
        await c.env.DB.prepare(
            `UPDATE ui_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`
        ).bind(user.id).run();
        return profileSuccessResponse({ success: true });
    } catch (e: any) {
        // Silently fail if table doesn't exist
        if (e.message.includes('no such table')) {
            return profileSuccessResponse({ success: true });
        }
        return profileErrorResponse("Failed to mark all notifications as read", 500);
    }
};
