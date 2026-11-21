import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { CommunityController } from '../controllers/community.controller.js';

export const communityRouter = Router();

/**
 * POST /api/v1/communities
 * Protected endpoint to create a new community and atomically register the creator as an ADMIN.
 */
communityRouter.post('/', authenticate, CommunityController.createCommunity);
