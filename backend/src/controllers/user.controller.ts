import type { Request, Response, NextFunction } from 'express';
import {
  updateProfileSchema,
  driverVerificationSubmissionSchema,
  userIdParamSchema,
  pendingVerificationsQuerySchema,
} from '../validators/userValidator.js';
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

/**
 * Controller handling driver licence submission (POST /api/v1/users/driver-verification).
 * Obtains caller identity strictly from req.user.userId.
 */
export async function submitDriverVerification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedData = driverVerificationSubmissionSchema.parse(req.body);
    const verification = await userService.submitDriverVerification(
      req.user.userId,
      validatedData
    );

    sendSuccess(
      res,
      { verification },
      'Driver licence submitted successfully and is awaiting administrative review',
      200
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling pending driver verifications list (GET /api/v1/users/driver-verification/pending).
 * Only accessible by ADMIN users.
 */
export async function listPendingVerifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedQuery = pendingVerificationsQuerySchema.parse(req.query);
    const result = await userService.listPendingVerifications(validatedQuery);

    sendSuccess(
      res,
      { pendingVerifications: result.pendingVerifications },
      'Pending driver verification requests retrieved successfully',
      200,
      result.pagination
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling administrative driver approval (PATCH /api/v1/users/:userId/driver-verification/approve).
 * Only accessible by ADMIN users.
 */
export async function approveDriverVerification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { userId: targetUserId } = userIdParamSchema.parse(req.params);
    const approvedUser = await userService.approveDriverVerification(
      req.user.userId,
      targetUserId
    );

    sendSuccess(
      res,
      { user: approvedUser },
      'Driver verification approved successfully',
      200
    );
  } catch (error) {
    next(error);
  }
}

export const UserController = {
  updateProfile,
  submitDriverVerification,
  listPendingVerifications,
  approveDriverVerification,
};
