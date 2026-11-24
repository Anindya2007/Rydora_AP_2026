import type { Request, Response, NextFunction } from 'express';
import { signupSchema, loginSchema } from '../validators/authValidator.js';
import { authService } from '../services/auth.service.js';
import { sessionService } from '../services/session.service.js';
import { sendSuccess } from '../utils/response.js';
import { UnauthorizedError } from '../utils/errors.js';
import { env } from '../config/env.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: (env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  path: '/',
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Controller handling user registration (POST /api/v1/auth/signup)
 */
export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validatedData = signupSchema.parse(req.body);
    const result = await authService.signup(validatedData);

    // Set HTTP-only session and token cookies
    res.cookie('sessionId', result.sessionId, COOKIE_OPTIONS);
    res.cookie('token', result.token, COOKIE_OPTIONS);

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

    // Set HTTP-only session and token cookies
    res.cookie('sessionId', result.sessionId, COOKIE_OPTIONS);
    res.cookie('token', result.token, COOKIE_OPTIONS);

    sendSuccess(res, result, 'Login successful', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling user logout (POST /api/v1/auth/logout)
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = req.cookies?.sessionId || (req.headers['x-session-id'] as string) || (req as any).sessionId;
    if (sessionId) {
      await sessionService.deleteSession(sessionId);
    }

    res.clearCookie('sessionId', { ...COOKIE_OPTIONS, maxAge: 0 });
    res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: 0 });

    sendSuccess(res, null, 'Logged out successfully', 200);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling retrieval of current authenticated user profile (GET /api/v1/auth/me)
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    sendSuccess(
      res,
      { user: authService.sanitizeUser(req.user) },
      'Current user retrieved successfully',
      200
    );
  } catch (error) {
    next(error);
  }
}

export const AuthController = {
  signup,
  login,
  logout,
  getMe,
};
