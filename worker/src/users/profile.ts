// 777lotto/portal/portal-bet/worker/src/handlers/profile.ts
import { Context as ProfileContext } from 'hono';
import { z } from 'zod';
import { AppEnv as ProfileAppEnv } from '../index.js';
import { errorResponse as profileErrorResponse, successResponse as profileSuccessResponse } from '../utils.js';
import { UserSchema, type User, type Notification } from '@portal/shared'; // Corrected type import
import { verifyPassword, hashPassword } from '../security/auth.js';
import { getStripe, listPaymentMethods, createSetupIntent } from '../stripe/index.js';

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

// --- START: NEW AND UPDATED NOTIFICATION HANDLERS ---

// This handler is no longer needed, as we have a more specific one.
// You can remove it or keep it if other parts of the app use it.
export const handleGetNotifications = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    try {
        const { results } = await c.env.DB.prepare(
            `SELECT * FROM notifications WHERE user_id = ? ORDER BY createdAt DESC LIMIT 20`
        ).bind(user.id).all<Notification>();
        return profileSuccessResponse(results || []);
    } catch (e: any) {
        console.error("Failed to get notifications:", e);
        return profileErrorResponse("Failed to retrieve notifications", 500);
    }
};

// New handler specifically for UI notifications
export const handleGetUiNotifications = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    try {
      const { results } = await c.env.DB.prepare(
        "SELECT * FROM notifications WHERE user_id = ? AND json_extract(channels, '$[0]') = 'ui' ORDER BY createdAt DESC LIMIT 20"
      ).bind(user.id).all<Notification>();
      return profileSuccessResponse(results || []);
    } catch (e: any) {
      console.error('Failed to fetch UI notifications', e);
      return profileErrorResponse("Failed to retrieve notifications", 500);
    }
};

// New handler to mark a single notification as read
export const handleMarkNotificationAsRead = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    const { id } = c.req.param();
    try {
        await c.env.DB.prepare(
            `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`
        ).bind(id, user.id).run();
        return profileSuccessResponse({ success: true });
    } catch (e: any) {
        console.error(`Failed to mark notification ${id} as read`, e);
        return profileErrorResponse("Failed to mark notification as read", 500);
    }
};

// Updated handler to mark all UI notifications as read
export const handleMarkAllNotificationsRead = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    try {
        await c.env.DB.prepare(
            `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND json_extract(channels, '$[0]') = 'ui' AND is_read = 0`
        ).bind(user.id).run();
        return profileSuccessResponse({ success: true });
    } catch (e: any) {
        return profileErrorResponse("Failed to mark all notifications as read", 500);
    }
};

// --- END: NEW AND UPDATED NOTIFICATION HANDLERS ---
