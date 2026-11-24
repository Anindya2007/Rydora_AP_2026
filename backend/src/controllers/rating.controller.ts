import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../utils/response.js';
import * as RatingService from '../services/rating.service.js';
import {
  createRatingSchema,
  ratingUserIdParamSchema,
} from '../validators/ratingValidator.js';

export class RatingController {
  /**
   * POST /api/v1/ratings
   * Submit a rating (1-5) for a completed booking.
   */
  static async submitRating(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = createRatingSchema.parse(req.body);
      const raterId = req.user!.userId;

      const result = await RatingService.submitRating(raterId, validatedInput);

      sendSuccess(
        res,
        result,
        'Rating submitted successfully and user aggregate updated',
        201
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ratings/me
   * Retrieve aggregate rating for the authenticated user.
   */
  static async getMyRatings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await RatingService.getUserRatingSummary(userId);

      sendSuccess(res, result, 'User rating retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ratings/:userId
   * GET /api/v1/ratings/user/:userId
   * GET /api/v1/users/:userId/ratings
   * Retrieve aggregate rating and summary for any target user or driver.
   */
  static async getUserRatings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = ratingUserIdParamSchema.parse(req.params);
      const result = await RatingService.getUserRatingSummary(userId);

      sendSuccess(res, result, 'User rating retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/ratings/booking/:bookingId/status
   * Check whether authenticated user has submitted a rating for a specific booking.
   */
  static async checkBookingRatingStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const bookingId = String(req.params.bookingId);
      const isRated = RatingService.isBookingRated(bookingId, userId);
      sendSuccess(res, { bookingId, isRated }, 'Rating status retrieved');
    } catch (error) {
      next(error);
    }
  }
}
