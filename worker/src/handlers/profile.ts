// worker/src/handlers/profile.ts - CORRECTED
import { Context as ProfileContext } from 'hono';
import { AppEnv as ProfileAppEnv } from '../index';
import { errorResponse as profileErrorResponse, successResponse as profileSuccessResponse } from '../utils';
import { UserSchema } from '@portal/shared';

const UpdateProfilePayload = UserSchema.pick({ name: true, email: true, phone: true }).partial();

export const handleGetProfile = async (c: ProfileContext<ProfileAppEnv>) => {
  const user = c.get('user');
  return profileSuccessResponse(user);
};

export const handleUpdateProfile = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = UpdateProfilePayload.safeParse(body);

    if (!parsed.success) {
        // FIX: Removed the third argument from the error response.
        return profileErrorResponse("Invalid data", 400);
    }

    const { name, email, phone } = parsed.data;

    try {
        await c.env.DB.prepare(
            `UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?`
        ).bind(name || user.name, email || user.email, phone !== undefined ? phone : user.phone, user.id).run();

        const updatedUser = { ...user, ...parsed.data };
        return profileSuccessResponse(updatedUser);
    } catch (e: any) {
        return profileErrorResponse("Failed to update profile", 500);
    }
};
