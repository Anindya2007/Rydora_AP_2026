import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { CommunityController } from '../controllers/community.controller.js';

export const communityRouter = Router();

/**
 * GET /api/v1/communities
 * Public endpoint to list and search active communities with pagination and filtering.
 */
communityRouter.get('/', CommunityController.getCommunities);

/**
 * GET /api/v1/communities/:communityId
 * Public endpoint to retrieve full details for a specific community by ID.
 */
communityRouter.get('/:communityId', CommunityController.getCommunityById);

/**
 * GET /api/v1/communities/:communityId/members
 * Protected endpoint to retrieve paginated directory of active members for a community.
 * Requires requester to be an ACTIVE member or ADMIN of the community.
 */
communityRouter.get('/:communityId/members', authenticate, CommunityController.getCommunityMembers);

/**
 * POST /api/v1/communities
 * Protected endpoint to create a new community and atomically register the creator as an ADMIN.
 */
communityRouter.post('/', authenticate, CommunityController.createCommunity);

/**
 * POST /api/v1/communities/:communityId/join
 * Protected endpoint to join an eligible active community as a MEMBER.
 */
communityRouter.post('/:communityId/join', authenticate, CommunityController.joinCommunity);
