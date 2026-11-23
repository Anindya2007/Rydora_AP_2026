import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { RatingController } from '../controllers/rating.controller.js';

export const ratingRouter = Router();

/**
 * POST /api/v1/ratings
 * Authenticated endpoint to rate a completed booking.
 */
ratingRouter.post('/', authenticate, RatingController.submitRating);

/**
 * GET /api/v1/ratings/me
 * Authenticated endpoint to retrieve current user's rating profile.
 */
ratingRouter.get('/me', authenticate, RatingController.getMyRatings);

/**
 * GET /api/v1/ratings/user/:userId
 * GET /api/v1/ratings/:userId
 * Authenticated endpoint to retrieve aggregate rating for any user/driver.
 */
ratingRouter.get('/user/:userId', authenticate, RatingController.getUserRatings);
ratingRouter.get('/:userId', authenticate, RatingController.getUserRatings);
