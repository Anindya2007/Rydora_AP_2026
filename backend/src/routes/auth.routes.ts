import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

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
