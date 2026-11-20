import type { Request, Response, NextFunction } from 'express';
import { signupSchema, loginSchema } from '../validators/authValidator.js';
import { authService } from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Controller handling user registration (POST /api/v1/auth/signup)
 */
export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validatedData = signupSchema.parse(req.body);
    const result = await authService.signup(validatedData);

    sendSuccess(res, result, 'User registered successfully', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling user authentication (POST /api/v1/auth/login)
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.login(validatedData);

    sendSuccess(res, result, 'Login successful', 200);
  } catch (error) {
    next(error);
  }
}

export const AuthController = {
  signup,
  login,
};
