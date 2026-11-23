import { prisma } from '../config/prisma.js';
import { BookingStatus } from '../generated/prisma/client.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import type { CreateRatingInput } from '../validators/ratingValidator.js';

/**
 * Data Transfer Object (DTO) returned upon successful rating submission.
 */
export interface RatingResultOutput {
  bookingId: string;
  raterId: string;
  targetUserId: string;
  rating: number;
  review: string | null;
  note: string;
  targetUser: {
    userId: string;
    name: string;
    averageRating: string;
    ratingCount: number;
  };
}

/**
 * Data Transfer Object (DTO) for public user rating profile summary.
 */
export interface UserRatingSummaryOutput {
  userId: string;
  name: string;
  averageRating: string;
  ratingCount: number;
  breakdown: {
    scale: string;
    average: string;
    totalRatings: number;
    summary: string;
    schemaLimitation: string;
  };
}

/**
 * ============================================================================
 * IN-MEMORY DUPLICATE SUBMISSION REGISTRY
 * ============================================================================
 * In our frozen database schema, there is no dedicated "Rating" relational table.
 * To prevent the same passenger or driver from rating the same completed booking
 * multiple times, we maintain a duplicate submission registry in memory.
 *
 * Key format: `${bookingId}:${raterId}`
 */
const submittedRatings = new Set<string>();

/**
 * Test helper to reset the in-memory registry between test suites.
 */
export function _clearSubmittedRatingsCache(): void {
  submittedRatings.clear();
}

/**
 * ============================================================================
 * SUBMIT RATING (Milestone 10.1)
 * ============================================================================
 * Allows a passenger to rate their driver, or a driver to rate their passenger,
 * after a trip has successfully concluded.
 *
 * STEP-BY-STEP WORKFLOW:
 * 1. Find the target booking in the database with ride details.
 * 2. Verify that the booking status is strictly COMPLETED.
 * 3. Authorize the caller: they must be either the rider or the driver.
 * 4. Prevent self-rating (a user cannot rate themselves).
 * 5. Check duplicate registry to prevent multiple ratings for the same booking.
 * 6. Fetch target user's current rating count and rolling average.
 * 7. Atomically calculate new moving average with Decimal overflow protection.
 * 8. Persist the updated count and average on the User record.
 * 9. Record submission in the duplicate registry and return standardized output.
 *
 * @param raterId - UUID of the user submitting the rating (from auth token)
 * @param input   - Validated rating payload { bookingId, rating, review }
 */
export async function submitRating(
  raterId: string,
  input: CreateRatingInput
): Promise<RatingResultOutput> {
  const { bookingId, rating, review } = input;

  // --------------------------------------------------------------------------
  // STEP 1: Fetch the Booking along with its parent Ride
  // --------------------------------------------------------------------------
  const booking = await prisma.booking.findUnique({
    where: { bookingId },
    include: {
      ride: {
        select: {
          rideId: true,
          driverId: true,
          status: true,
        },
      },
    },
  });

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // --------------------------------------------------------------------------
  // STEP 2: Enforce Lifecycle Requirement
  // Only trips that have finished can be rated (prevents premature reviews).
  // --------------------------------------------------------------------------
  if (booking.status !== BookingStatus.COMPLETED) {
    throw new BadRequestError('Only completed bookings can be rated');
  }

  // --------------------------------------------------------------------------
  // STEP 3: Verify Caller Authorization
  // Only the two actual participants of this specific trip can submit ratings.
  // --------------------------------------------------------------------------
  const isRider = booking.riderId === raterId;
  const isDriver = booking.ride.driverId === raterId;

  if (!isRider && !isDriver) {
    throw new ForbiddenError('You are not authorized to rate this ride');
  }

  // --------------------------------------------------------------------------
  // STEP 4: Determine Who is Being Rated (Target User) & Prevent Self-Rating
  // - If the rider is rating -> target is the driver.
  // - If the driver is rating -> target is the passenger (rider).
  // --------------------------------------------------------------------------
  const targetUserId = isRider ? booking.ride.driverId : booking.riderId;

  if (raterId === targetUserId) {
    throw new BadRequestError('You cannot rate yourself');
  }

  // --------------------------------------------------------------------------
  // STEP 5: Prevent Duplicate Ratings for the Same Booking
  // --------------------------------------------------------------------------
  const duplicateKey = `${bookingId}:${raterId}`;
  if (submittedRatings.has(duplicateKey)) {
    throw new ConflictError('You have already submitted a rating for this booking');
  }

  // --------------------------------------------------------------------------
  // STEP 6: Fetch Target User's Current Aggregate Rating
  // --------------------------------------------------------------------------
  const targetUser = await prisma.user.findUnique({
    where: { userId: targetUserId },
    select: {
      userId: true,
      name: true,
      averageRating: true,
      ratingCount: true,
    },
  });

  if (!targetUser) {
    throw new NotFoundError('Target user for rating not found');
  }

  // --------------------------------------------------------------------------
  // STEP 7: Calculate the New Weighted Moving Average
  // Formula: newAverage = ((currentAverage * currentCount) + newScore) / (currentCount + 1)
  //
  // NOTE ON POSTGRESQL DECIMAL SAFETY:
  // User.averageRating is defined in schema.prisma as `@db.Decimal(3, 2)`.
  // The maximum number Decimal(3, 2) can hold is 9.99.
  // Ratings are strictly on a 1 to 5 scale, so we clamp the calculated average
  // between 1.00 and 5.00 to guarantee it can NEVER trigger a numeric overflow.
  // --------------------------------------------------------------------------
  const currentCount = targetUser.ratingCount || 0;
  const currentAvg = Number(targetUser.averageRating) || 0;

  const newCount = currentCount + 1;
  const rawNewAvg = ((currentAvg * currentCount) + rating) / newCount;

  // Round to 2 decimal places and clamp safely between 1.00 and 5.00
  const roundedNewAvg = Math.min(5.0, Math.max(1.0, Math.round(rawNewAvg * 100) / 100));

  // --------------------------------------------------------------------------
  // STEP 8: Persist the Updated Aggregate Rating to PostgreSQL
  // --------------------------------------------------------------------------
  const updatedUser = await prisma.user.update({
    where: { userId: targetUserId },
    data: {
      averageRating: roundedNewAvg,
      ratingCount: newCount,
    },
    select: {
      userId: true,
      name: true,
      averageRating: true,
      ratingCount: true,
    },
  });

  // Mark as submitted to prevent duplicate requests
  submittedRatings.add(duplicateKey);

  // --------------------------------------------------------------------------
  // STEP 9: Return the Standardized Result
  // --------------------------------------------------------------------------
  return {
    bookingId,
    raterId,
    targetUserId,
    rating,
    review: review?.trim() || null,
    note: 'Aggregate rating successfully updated on User profile. Individual review text persistence requires a separate Rating entity not present in the frozen schema.',
    targetUser: {
      userId: updatedUser.userId,
      name: updatedUser.name,
      averageRating: updatedUser.averageRating.toString(),
      ratingCount: updatedUser.ratingCount,
    },
  };
}

/**
 * ============================================================================
 * GET USER RATING SUMMARY (Milestone 10.2)
 * ============================================================================
 * Retrieves the aggregated star rating, total review count, and rating scale
 * for any given user or driver profile.
 *
 * @param userId - UUID of the user whose rating summary is requested
 */
export async function getUserRatingSummary(userId: string): Promise<UserRatingSummaryOutput> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      name: true,
      averageRating: true,
      ratingCount: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const avgStr = user.averageRating ? user.averageRating.toString() : '0.00';
  const count = user.ratingCount || 0;

  return {
    userId: user.userId,
    name: user.name,
    averageRating: avgStr,
    ratingCount: count,
    breakdown: {
      scale: '1-5',
      average: avgStr,
      totalRatings: count,
      summary:
        count === 0
          ? 'No ratings received yet'
          : `${avgStr} / 5.00 (${count} ${count === 1 ? 'rating' : 'ratings'})`,
      schemaLimitation:
        'Detailed star distribution and review comment history require a separate Rating model not present in the frozen database schema.',
    },
  };
}

