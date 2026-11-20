import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { UserController } from '../controllers/user.controller.js';

export const userRouter = Router();

/**
 * PATCH /api/v1/users/me
 * Protected endpoint to update permitted profile fields for the authenticated user.
 */
userRouter.patch('/me', authenticate, UserController.updateProfile);
