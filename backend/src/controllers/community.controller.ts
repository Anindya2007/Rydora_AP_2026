import type { Request, Response, NextFunction } from 'express';
import {
  createCommunitySchema,
  communityQuerySchema,
  communityIdParamSchema,
} from '../validators/communityValidator.js';
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

/**
 * Controller handling community listing & filtering (GET /api/v1/communities).
 * Validates query parameters (search, domain, page, limit) and returns paginated active communities.
 */
export async function getCommunities(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validatedQuery = communityQuerySchema.parse(req.query);
    const result = await communityService.getCommunities(validatedQuery);

    sendSuccess(
      res,
      { communities: result.communities },
      'Communities retrieved successfully',
      200,
      result.pagination
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controller handling community detail retrieval (GET /api/v1/communities/:communityId).
 * Validates the communityId UUID route parameter and returns full community details.
 */
export async function getCommunityById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { communityId } = communityIdParamSchema.parse(req.params);
    const community = await communityService.getCommunityById(communityId);

    sendSuccess(res, { community }, 'Community retrieved successfully', 200);
  } catch (error) {
    next(error);
  }
}

export const CommunityController = {
  createCommunity,
  getCommunities,
  getCommunityById,
};
