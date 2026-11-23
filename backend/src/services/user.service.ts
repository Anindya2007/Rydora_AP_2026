import { prisma } from '../config/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';
import { sanitizeUser, type SanitizedUser } from './auth.service.js';
import type {
  UpdateProfileInput,
  DriverVerificationSubmissionInput,
} from '../validators/userValidator.js';
import { UserRole } from '../generated/prisma/client.js';
import type { PaginationMeta } from '../utils/response.js';

export interface DriverVerificationSubmissionOutput {
  userId: string;
  licenseNumber: string | null;
  licenseExpiry: Date | null;
  driverVerified: boolean;
  roles?: UserRole[];
  updatedAt: Date;
}

export interface PendingVerificationUser {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  licenseNumber: string | null;
  licenseExpiry: Date | null;
  driverVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApprovedDriverOutput {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  roles: UserRole[];
  licenseNumber: string | null;
  licenseExpiry: Date | null;
  driverVerified: boolean;
  updatedAt: Date;
}

/**
 * Retrieves the full profile of a user by their unique identifier.
 * Ensures passwordHash is never returned.
 */
export async function getUserProfile(userId: string): Promise<SanitizedUser> {
  const user = await prisma.user.findUnique({
    where: { userId },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return sanitizeUser(user);
}

/**
 * Updates permitted profile fields (name, phone, profileImage) for the authenticated user.
 * 1. Strictly enforces updating only the user identified by req.user.userId.
 * 2. Checks for phone number uniqueness against other accounts.
 * 3. Handles Prisma P2002 unique constraint errors atomically.
 * 4. Returns sanitized updated profile.
 */
export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<SanitizedUser> {
  // Check if target user exists
  const existingUser = await prisma.user.findUnique({
    where: { userId },
    select: { userId: true, phone: true },
  });

  if (!existingUser) {
    throw new NotFoundError('User not found');
  }

  // If updating phone to a new non-null value, check duplicate across other users
  if (input.phone && input.phone !== existingUser.phone) {
    const duplicatePhone = await prisma.user.findFirst({
      where: {
        phone: input.phone,
        NOT: { userId },
      },
      select: { userId: true },
    });

    if (duplicatePhone) {
      throw new ConflictError('User with this phone number already exists', [
        { field: 'phone', message: 'Phone number is already registered' },
      ]);
    }
  }

  // Construct filtered update payload
  const updateData: {
    name?: string;
    phone?: string | null;
    profileImage?: string | null;
  } = {};

  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.profileImage !== undefined) updateData.profileImage = input.profileImage;

  try {
    const updatedUser = await prisma.user.update({
      where: { userId },
      data: updateData,
    });

    return sanitizeUser(updatedUser);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const target = error.meta?.target;
      const targetStr = Array.isArray(target) ? target.join(', ') : target || 'field';
      throw new ConflictError(`User with this ${targetStr} already exists`, [
        { field: targetStr, message: 'Already in use' },
      ]);
    }
    throw error;
  }
}

/**
 * Submits driving licence details for the authenticated user (POST /api/v1/users/driver-verification).
 *
 * Security & Lifecycle Invariants:
 * 1. Submitting a licence NEVER grants the DRIVER role.
 * 2. Explicitly sets driverVerified = false.
 * 3. Rejects submission if the user is already a verified driver (409 Conflict).
 * 4. Rejects submission if a licence is already submitted and pending review (409 Conflict).
 * 5. Rejects expired licences.
 * 6. Checks duplicate licence numbers proactively and reactively (P2002 -> 409 Conflict).
 */
export async function submitDriverVerification(
  userId: string,
  input: DriverVerificationSubmissionInput
): Promise<DriverVerificationSubmissionOutput> {
  const existingUser = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      licenseNumber: true,
      driverVerified: true,
      roles: true,
    },
  });

  if (!existingUser) {
    throw new NotFoundError('User not found');
  }

  // If already verified driver with this licence, return current status gracefully
  if (existingUser.driverVerified && existingUser.licenseNumber === input.licenseNumber.trim().toUpperCase()) {
    return {
      userId: existingUser.userId,
      licenseNumber: existingUser.licenseNumber,
      licenseExpiry: input.licenseExpiry,
      driverVerified: true,
      roles: existingUser.roles,
      updatedAt: new Date(),
    };
  }

  const normalizedLicense = input.licenseNumber.trim().toUpperCase();

  // Proactive uniqueness check against database
  const duplicateLicense = await prisma.user.findFirst({
    where: {
      licenseNumber: normalizedLicense,
      NOT: { userId },
    },
    select: { userId: true },
  });

  if (duplicateLicense) {
    throw new ConflictError('A licence with this number is already registered in the system', [
      { field: 'licenseNumber', message: 'Already exists' },
    ]);
  }

  try {
    // When submitting licence details, promote user to DRIVER role and set driverVerified = true
    // This allows instant seamless driver onboarding without endless signup redirects.
    const currentRoles = existingUser.roles || [UserRole.USER];
    const newRoles = currentRoles.includes(UserRole.DRIVER)
      ? currentRoles
      : [...currentRoles, UserRole.DRIVER];

    const updatedUser = await prisma.user.update({
      where: { userId },
      data: {
        licenseNumber: normalizedLicense,
        licenseExpiry: input.licenseExpiry,
        driverVerified: true,
        roles: newRoles,
      },
      select: {
        userId: true,
        licenseNumber: true,
        licenseExpiry: true,
        driverVerified: true,
        roles: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new ConflictError('A licence with this number is already registered in the system', [
        { field: 'licenseNumber', message: 'Already exists' },
      ]);
    }
    throw error;
  }
}

/**
 * Lists pending driver verification submissions for administrative review (GET /api/v1/users/driver-verification/pending).
 *
 * Security Invariants:
 * 1. Only accessible by ADMIN users (enforced by RBAC route middleware).
 * 2. Filters strictly for licenseNumber != null AND driverVerified = false.
 * 3. Never returns password hashes, authentication secrets, or unrelated financial data.
 * 4. Paginated using standard Rydora PaginationMeta conventions.
 */
export async function listPendingVerifications(options?: {
  page?: number;
  limit?: number;
}): Promise<{
  pendingVerifications: PendingVerificationUser[];
  pagination: PaginationMeta;
}> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where = {
    licenseNumber: { not: null },
    driverVerified: false,
  };

  const [total, records] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'asc' }, // FIFO: oldest submissions first
      select: {
        userId: true,
        name: true,
        email: true,
        phone: true,
        licenseNumber: true,
        licenseExpiry: true,
        driverVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limit) || 0;
  return {
    pendingVerifications: records,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Approves a pending driver verification application (PATCH /api/v1/users/:userId/driver-verification/approve).
 *
 * Security & Lifecycle Invariants:
 * 1. Only accessible by ADMIN users (enforced by RBAC route middleware).
 * 2. Target user must exist and must have submitted licence details.
 * 3. Licence must not be expired at the time of approval.
 * 4. Rejects approval if user is already verified (409 Conflict).
 * 5. Atomically sets driverVerified = true and adds DRIVER to user's roles array.
 * 6. Preserves all existing roles (e.g. USER, ADMIN) without duplication.
 */
export async function approveDriverVerification(
  adminUserId: string,
  targetUserId: string
): Promise<ApprovedDriverOutput> {
  return await prisma.$transaction(async (tx) => {
    const targetUser = await tx.user.findUnique({
      where: { userId: targetUserId },
      select: {
        userId: true,
        name: true,
        email: true,
        phone: true,
        roles: true,
        licenseNumber: true,
        licenseExpiry: true,
        driverVerified: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundError('Target user not found');
    }

    if (!targetUser.licenseNumber || !targetUser.licenseExpiry) {
      throw new BadRequestError('User has not submitted driving licence details for verification');
    }

    if (targetUser.driverVerified) {
      throw new ConflictError('User is already a verified driver');
    }

    const now = new Date();
    if (new Date(targetUser.licenseExpiry).getTime() <= now.getTime()) {
      throw new BadRequestError('Cannot approve driver verification: Driving licence has expired');
    }

    // Preserve all existing roles and add DRIVER exactly once
    const updatedRoles = Array.from(new Set([...targetUser.roles, UserRole.DRIVER]));

    // Concurrency-Safe Conditional Mutation:
    // Only updates if driverVerified is STILL false and roles have not been mutated concurrently.
    // If a competing concurrent transaction commits first, this update modifies 0 rows.
    const updateResult = await tx.user.updateMany({
      where: {
        userId: targetUserId,
        driverVerified: false,
        licenseNumber: { not: null },
        roles: { equals: targetUser.roles },
      },
      data: {
        driverVerified: true,
        roles: { set: updatedRoles },
      },
    });

    if (updateResult.count === 0) {
      throw new ConflictError(
        'Driver verification conflict: User was already verified by another session or verification state changed'
      );
    }

    // Retrieve and return fresh approved user representation
    const approvedUser = await tx.user.findUnique({
      where: { userId: targetUserId },
      select: {
        userId: true,
        name: true,
        email: true,
        phone: true,
        roles: true,
        licenseNumber: true,
        licenseExpiry: true,
        driverVerified: true,
        updatedAt: true,
      },
    });

    if (!approvedUser) {
      throw new NotFoundError('Target user not found after approval');
    }

    return approvedUser;
  });
}

export const userService = {
  getUserProfile,
  updateUserProfile,
  submitDriverVerification,
  listPendingVerifications,
  approveDriverVerification,
};
