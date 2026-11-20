import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { sanitizeUser, type SanitizedUser } from './auth.service.js';
import type { UpdateProfileInput } from '../validators/userValidator.js';

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

export const userService = {
  getUserProfile,
  updateUserProfile,
};
