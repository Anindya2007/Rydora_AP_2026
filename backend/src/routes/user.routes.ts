import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { UserController } from '../controllers/user.controller.js';
import { RatingController } from '../controllers/rating.controller.js';
import {
  driverVerificationSubmissionSchema,
  userIdParamSchema,
  pendingVerificationsQuerySchema,
} from '../validators/userValidator.js';

export const userRouter = Router();

/**
 * Validation middleware for driver verification submission.
 */
export const validateSubmitDriverVerification = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    req.body = driverVerificationSubmissionSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validation middleware for querying pending verifications.
 */
export const validatePendingVerificationsQuery = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    pendingVerificationsQuerySchema.parse(req.query);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Validation middleware for target userId route param.
 */
export const validateUserIdParam = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    userIdParamSchema.parse(req.params);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/users/me
 * Protected endpoint to fetch current user profile.
 */
userRouter.get('/me', authenticate, UserController.getProfile);

/**
 * PATCH /api/v1/users/me
 * Protected endpoint to update permitted profile fields for the authenticated user.
 */
userRouter.patch('/me', authenticate, UserController.updateProfile);

/**
 * POST /api/v1/users/driver-verification
 * Protected endpoint for authenticated users to submit driving licence details.
 *
 * Security & Lifecycle Invariants:
 * 1. authenticate - Validates JWT Bearer token and attaches fresh user state to req.user.
 * 2. validateSubmitDriverVerification - Validates licence number and future expiry date.
 * 3. UserController.submitDriverVerification - Saves licence details, keeps driverVerified = false,
 *    and NEVER grants the DRIVER role.
 */
userRouter.post(
  '/driver-verification',
  authenticate,
  validateSubmitDriverVerification,
  UserController.submitDriverVerification
);

/**
 * GET /api/v1/users/driver-verification/pending
 * Protected ADMIN-only endpoint to list unverified driver licence submissions.
 * NOTE: Declared before /:userId routes to prevent route collision.
 *
 * Security & Lifecycle Invariants:
 * 1. authenticate - Validates JWT Bearer token.
 * 2. requireRoles('ADMIN') - Restricts access strictly to authorized administrators.
 * 3. validatePendingVerificationsQuery - Validates pagination parameters (page, limit).
 * 4. UserController.listPendingVerifications - Returns sanitized list of pending verifications.
 */
userRouter.get(
  '/driver-verification/pending',
  authenticate,
  requireRoles('ADMIN'),
  validatePendingVerificationsQuery,
  UserController.listPendingVerifications
);

/**
 * PATCH /api/v1/users/:userId/driver-verification/approve
 * Protected ADMIN-only endpoint to approve driver verification and promote user.
 *
 * Security & Lifecycle Invariants:
 * 1. authenticate - Validates JWT Bearer token.
 * 2. requireRoles('ADMIN') - Restricts access strictly to authorized administrators.
 * 3. validateUserIdParam - Validates target userId parameter as UUID.
 * 4. UserController.approveDriverVerification - Atomically sets driverVerified = true,
 *    adds DRIVER to roles, and preserves all existing roles.
 */
userRouter.patch(
  '/:userId/driver-verification/approve',
  authenticate,
  requireRoles('ADMIN'),
  validateUserIdParam,
  UserController.approveDriverVerification
);

/**
 * GET /api/v1/users/:userId/ratings
 * Public/authenticated endpoint to retrieve user's aggregate rating.
 */
userRouter.get(
  '/:userId/ratings',
  authenticate,
  validateUserIdParam,
  RatingController.getUserRatings
);
