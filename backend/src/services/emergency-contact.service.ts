import { prisma } from '../config/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import type {
  CreateEmergencyContactInput,
  UpdateEmergencyContactInput,
} from '../validators/emergency-contact.validator.js';

export interface EmergencyContactOutput {
  contactId: string;
  userId: string;
  name: string;
  phone: string;
  relationship: string | null;
  isPrimary: boolean;
  createdAt: Date;
}

export const emergencyContactSelectProjection = {
  contactId: true,
  userId: true,
  name: true,
  phone: true,
  relationship: true,
  isPrimary: true,
  createdAt: true,
};

export const MAX_EMERGENCY_CONTACTS = 5;

/**
 * Creates a new emergency contact for the authenticated user.
 *
 * Rules & Invariant Safeguards:
 * 1. User isolation: userId is derived exclusively from authentication.
 * 2. Serialization: Uses a PostgreSQL row-level lock (FOR UPDATE) on the owning user row
 *    to prevent concurrent requests from racing past the contact count limit or primary assignment.
 * 3. Capacity limit: A user can save at most 5 emergency contacts. The count is strictly evaluated
 *    within the serialized transaction.
 * 4. Phone uniqueness: A user cannot add duplicate phone numbers. Guarded by application check
 *    and database @@unique([userId, phone]) constraint.
 * 5. Primary designation: If isPrimary is true, any existing primary contact is atomically demoted.
 *    If this is the user's first contact and isPrimary is not specified, it defaults to true.
 */
export async function createEmergencyContact(
  userId: string,
  input: CreateEmergencyContactInput
): Promise<EmergencyContactOutput> {
  return await prisma.$transaction(async (tx) => {
    // 1. Acquire row-level lock on owning user row to serialize per-user mutations
    await tx.$queryRaw`SELECT 1 FROM "users" WHERE "user_id" = ${userId}::uuid FOR UPDATE`;

    // 2. Count existing contacts inside the locked transaction
    const existingCount = await tx.emergencyContact.count({
      where: { userId },
    });

    if (existingCount >= MAX_EMERGENCY_CONTACTS) {
      throw new BadRequestError(
        `Cannot add more than ${MAX_EMERGENCY_CONTACTS} emergency contacts`
      );
    }

    // 3. Pre-check phone uniqueness for clear conflict error
    const duplicate = await tx.emergencyContact.findFirst({
      where: {
        userId,
        phone: input.phone,
      },
    });

    if (duplicate) {
      throw new ConflictError(
        'An emergency contact with this phone number already exists for your account'
      );
    }

    const shouldBePrimary =
      input.isPrimary !== undefined ? input.isPrimary : existingCount === 0;

    if (shouldBePrimary) {
      await tx.emergencyContact.updateMany({
        where: {
          userId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    try {
      const contact = await tx.emergencyContact.create({
        data: {
          userId,
          name: input.name,
          phone: input.phone,
          relationship: input.relationship ?? null,
          isPrimary: shouldBePrimary,
        },
        select: emergencyContactSelectProjection,
      });

      return contact;
    } catch (error: any) {
      // Catch Prisma P2002 unique constraint violation on @@unique([userId, phone])
      if (error?.code === 'P2002') {
        throw new ConflictError(
          'An emergency contact with this phone number already exists for your account'
        );
      }
      throw error;
    }
  });
}

/**
 * Retrieves all emergency contacts for the authenticated user.
 * Ordered with primary contact first, followed by others in order of creation.
 */
export async function listEmergencyContacts(
  userId: string
): Promise<EmergencyContactOutput[]> {
  return await prisma.emergencyContact.findMany({
    where: { userId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    select: emergencyContactSelectProjection,
  });
}

/**
 * Retrieves a single emergency contact by ID, strictly enforcing ownership.
 */
export async function getEmergencyContactById(
  userId: string,
  contactId: string
): Promise<EmergencyContactOutput> {
  const contact = await prisma.emergencyContact.findUnique({
    where: { contactId },
    select: emergencyContactSelectProjection,
  });

  if (!contact) {
    throw new NotFoundError('Emergency contact not found');
  }

  if (contact.userId !== userId) {
    throw new ForbiddenError(
      'You are not authorized to access this emergency contact'
    );
  }

  return contact;
}

/**
 * Updates an existing emergency contact belonging to the authenticated user.
 *
 * Rules & Invariant Safeguards:
 * 1. Serialization: Serializes per-user updates via row-level lock on the owning user.
 * 2. Ownership check: Must belong to requesting user.
 * 3. Primary invariant preservation: A user cannot explicitly unset their only primary contact
 *    to false. At least one contact must remain primary whenever contacts exist.
 * 4. Phone conflict check: If phone is updated, cannot collide with another contact belonging to user.
 * 5. Primary flag update: If setting to primary, demotes other contacts for this user.
 */
export async function updateEmergencyContact(
  userId: string,
  contactId: string,
  input: UpdateEmergencyContactInput
): Promise<EmergencyContactOutput> {
  return await prisma.$transaction(async (tx) => {
    // 1. Acquire row-level lock on owning user row
    await tx.$queryRaw`SELECT 1 FROM "users" WHERE "user_id" = ${userId}::uuid FOR UPDATE`;

    const existing = await tx.emergencyContact.findUnique({
      where: { contactId },
    });

    if (!existing) {
      throw new NotFoundError('Emergency contact not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenError(
        'You are not authorized to update this emergency contact'
      );
    }

    // Invariant: Prevent explicitly unsetting the primary contact to false
    if (input.isPrimary === false && existing.isPrimary) {
      throw new BadRequestError(
        'Cannot unset primary contact. At least one emergency contact must remain designated as primary. To change your primary contact, set another contact as primary.'
      );
    }

    if (input.phone && input.phone !== existing.phone) {
      const duplicate = await tx.emergencyContact.findFirst({
        where: {
          userId,
          phone: input.phone,
          NOT: { contactId },
        },
      });

      if (duplicate) {
        throw new ConflictError(
          'An emergency contact with this phone number already exists for your account'
        );
      }
    }

    if (input.isPrimary === true) {
      await tx.emergencyContact.updateMany({
        where: {
          userId,
          isPrimary: true,
          NOT: { contactId },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    try {
      const updated = await tx.emergencyContact.update({
        where: { contactId },
        data: {
          name: input.name,
          phone: input.phone,
          relationship: input.relationship,
          isPrimary: input.isPrimary,
        },
        select: emergencyContactSelectProjection,
      });

      return updated;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictError(
          'An emergency contact with this phone number already exists for your account'
        );
      }
      throw error;
    }
  });
}

/**
 * Deletes an existing emergency contact belonging to the authenticated user.
 *
 * Rules:
 * 1. Serialization: Serializes per-user deletions via row-level lock on the owning user.
 * 2. Ownership check: Must belong to requesting user.
 * 3. Primary fallback: If the primary contact is deleted and other contacts remain,
 *    the oldest remaining contact is promoted to primary.
 */
export async function deleteEmergencyContact(
  userId: string,
  contactId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Acquire row-level lock on owning user row
    await tx.$queryRaw`SELECT 1 FROM "users" WHERE "user_id" = ${userId}::uuid FOR UPDATE`;

    const existing = await tx.emergencyContact.findUnique({
      where: { contactId },
    });

    if (!existing) {
      throw new NotFoundError('Emergency contact not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenError(
        'You are not authorized to delete this emergency contact'
      );
    }

    await tx.emergencyContact.delete({
      where: { contactId },
    });

    if (existing.isPrimary) {
      const nextPrimary = await tx.emergencyContact.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      if (nextPrimary) {
        await tx.emergencyContact.update({
          where: { contactId: nextPrimary.contactId },
          data: { isPrimary: true },
        });
      }
    }
  });
}

export const emergencyContactService = {
  createEmergencyContact,
  listEmergencyContacts,
  getEmergencyContactById,
  updateEmergencyContact,
  deleteEmergencyContact,
};
