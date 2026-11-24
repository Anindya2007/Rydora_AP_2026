import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';

export const authRouter = Router();

/**
 * POST /api/v1/auth/signup
 * Registers a new user account with hashed password and returns a 24-hour JWT token.
 */
authRouter.post('/signup', AuthController.signup);

/**
 * POST /api/v1/auth/login
 * Authenticates user credentials and returns a 24-hour JWT token.
 */
authRouter.post('/login', AuthController.login);

/**
 * POST /api/v1/auth/logout
 * Terminates user session from database and clears auth cookies.
 */
authRouter.post('/logout', AuthController.logout);

/**
 * GET /api/v1/auth/me
 * Retrieves the currently authenticated user's profile.
 */
authRouter.get('/me', authenticate, AuthController.getMe);
