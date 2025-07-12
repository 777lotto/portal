// worker/src/handlers/profile.ts - MODIFIED
import { Context as ProfileContext } from 'hono';
import { z } from 'zod';
import { AppEnv as ProfileAppEnv } from '../index.js';
import { errorResponse as profileErrorResponse, successResponse as profileSuccessResponse } from '../utils.js';
import { UserSchema, type User } from '@portal/shared';
import { verifyPassword, hashPassword } from '../auth.js';

// MODIFIED: Added notification preferences to the payload
const UpdateProfilePayload = UserSchema.pick({
    name: true,
    email: true,
    phone: true,
    company_name: true,
    email_notifications_enabled: true,
    sms_notifications_enabled: true
}).partial();

const ChangePasswordPayload = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
});


export const handleGetProfile = async (c: ProfileContext<ProfileAppEnv>) => {
  const user = c.get('user');
  return profileSuccessResponse(user);
};

export const handleUpdateProfile = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = UpdateProfilePayload.safeParse(body);

    if (!parsed.success) {
        return profileErrorResponse("Invalid data", 400, parsed.error.flatten());
    }

    const { name, email, phone, company_name, email_notifications_enabled, sms_notifications_enabled } = parsed.data;

    try {
        await c.env.DB.prepare(
            `UPDATE users SET name = ?, email = ?, phone = ?, company_name = ?, email_notifications_enabled = ?, sms_notifications_enabled = ? WHERE id = ?`
        ).bind(
            name ?? user.name,
            email ?? user.email,
            phone ?? user.phone,
            company_name ?? user.company_name,
            email_notifications_enabled !== undefined ? (email_notifications_enabled ? 1 : 0) : (user.email_notifications_enabled ? 1 : 0),
            sms_notifications_enabled !== undefined ? (sms_notifications_enabled ? 1 : 0) : (user.sms_notifications_enabled ? 1 : 0),
            user.id
        ).run();

        const updatedUserResult = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(user.id).first<User>();
        return profileSuccessResponse(updatedUserResult);
    } catch (e: any) {
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
