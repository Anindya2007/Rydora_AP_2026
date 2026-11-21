import type { Request, Response, NextFunction } from 'express';
import { createCommunitySchema } from '../validators/communityValidator.js';
import { communityService } from '../services/community.service.js';
import { sendSuccess } from '../utils/response.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Controller handling community creation (POST /api/v1/communities).
 * Obtains the creator identity strictly from the authenticated req.user.userId.
 */
export async function createCommunity(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user || !req.user.userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const validatedData = createCommunitySchema.parse(req.body);
    const community = await communityService.createCommunity(
      req.user.userId,
      validatedData
    );

    sendSuccess(res, { community }, 'Community created successfully', 201);
  } catch (error) {
    next(error);
  }
}

export const CommunityController = {
  createCommunity,
};
