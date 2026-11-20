import type { Request, Response, NextFunction } from 'express';
import { updateProfileSchema } from '../validators/userValidator.js';
import { userService } from '../services/user.service.js';
import { sendSuccess } from '../utils/response.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Controller handling user profile updates (PATCH /api/v1/users/me).
 * Obtains the user identity strictly from req.user.userId.
 */
export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedData = updateProfileSchema.parse(req.body);
    const updatedUser = await userService.updateUserProfile(req.user.userId, validatedData);

    sendSuccess(res, { user: updatedUser }, 'Profile updated successfully', 200);
  } catch (error) {
    next(error);
  }
}

export const UserController = {
  updateProfile,
};
