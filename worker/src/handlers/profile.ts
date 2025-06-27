// worker/src/handlers/profile.ts
// --------------------------------------
import { Context as ProfileContext } from 'hono';
import { z as zod } from 'zod';
import { AppEnv as ProfileAppEnv } from '../index';
import { errorResponse as profileErrorResponse, successResponse as profileSuccessResponse } from '../utils';
import { UserSchema } from '@portal/shared';

const UpdateProfilePayload = UserSchema.pick({ name: true, email: true, phone: true }).partial();

export const handleGetProfile = async (c: ProfileContext<ProfileAppEnv>) => {
  const user = c.get('user');
  // Return the user object from the token, which is the single source of truth
  return profileSuccessResponse(user);
};

export const handleUpdateProfile = async (c: ProfileContext<ProfileAppEnv>) => {
    const user = c.get('user');
    const body = await c.req.json();
    const parsed = UpdateProfilePayload.safeParse(body);

    if (!parsed.success) {
        return profileErrorResponse("Invalid data", 400, parsed.error.flatten());
    }

    const { name, email, phone } = parsed.data;

    try {
        await c.env.DB.prepare(
            `UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?`
        ).bind(
            name || user.name,
            email || user.email,
            phone !== undefined ? phone : user.phone, // handle null case
            user.id
        ).run();

        const updatedUser = { ...user, ...parsed.data };
        return profileSuccessResponse(updatedUser);

    } catch (e: any) {
        console.error("Profile update failed:", e.message);
        return profileErrorResponse("Failed to update profile", 500);
    }
};
