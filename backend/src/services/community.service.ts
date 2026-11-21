import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import type { PaginationMeta } from '../utils/response.js';
import type { CommunityQueryInput, CreateCommunityInput } from '../validators/communityValidator.js';

export interface CommunityOutput {
  communityId: string;
  name: string;
  domain: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  membersCount?: number;
}

export interface CommunityCreatorOutput {
  userId: string;
  name: string;
  email: string;
  profileImage: string | null;
}

export interface CommunityDetailOutput {
  communityId: string;
  name: string;
  domain: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  membersCount: number;
  createdBy: CommunityCreatorOutput;
}

export interface CommunityMembershipOutput {
  membershipId: string;
  communityId: string;
  userId: string;
  memberRole: 'MEMBER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE';
  joinedAt: Date;
}

export interface PaginatedCommunitiesResult {
  communities: CommunityOutput[];
  pagination: PaginationMeta;
}

/**
 * Creates a new community and atomically registers the creator as an ADMIN member.
 *
 * 1. Verifies that the creator user exists.
 * 2. Checks whether a community with the same domain or name already exists (case-insensitive).
 * 3. Uses an atomic Prisma transaction to:
 *    a. Insert the Community record.
 *    b. Insert a CommunityMembership record for the creator with memberRole: 'ADMIN' and status: 'ACTIVE'.
 * 4. Returns the created community representation with membersCount = 1.
 */
export async function createCommunity(
  creatorUserId: string,
  input: CreateCommunityInput
): Promise<CommunityOutput> {
  // 1. Verify creator exists
  const creator = await prisma.user.findUnique({
    where: { userId: creatorUserId },
    select: { userId: true, email: true },
  });

  if (!creator) {
    throw new NotFoundError('Creator user not found');
  }

  const normalizedDomain = input.domain.trim().toLowerCase();
  const trimmedName = input.name.trim();

  // 2. Check for duplicate community by domain or name
  const existingCommunity = await prisma.community.findFirst({
    where: {
      OR: [
        { domain: { equals: normalizedDomain, mode: 'insensitive' } },
        { name: { equals: trimmedName, mode: 'insensitive' } },
      ],
    },
    select: { communityId: true, domain: true, name: true },
  });

  if (existingCommunity) {
    const isDomainConflict = existingCommunity.domain.toLowerCase() === normalizedDomain;
    const conflictingField = isDomainConflict ? 'domain' : 'name';
    const message = isDomainConflict
      ? 'A community with this email domain already exists'
      : 'A community with this name already exists';

    throw new ConflictError(message, [
      { field: conflictingField, message },
    ]);
  }

  // 3. Atomically create community and creator membership in a single transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          name: trimmedName,
          domain: normalizedDomain,
          description: input.description ?? null,
          status: 'ACTIVE',
          createdById: creatorUserId,
        },
      });

      await tx.communityMembership.create({
        data: {
          communityId: community.communityId,
          userId: creatorUserId,
          memberRole: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      return community;
    });

    return {
      communityId: result.communityId,
      name: result.name,
      domain: result.domain,
      description: result.description,
      status: result.status,
      createdById: result.createdById,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      membersCount: 1,
    };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const target = error.meta?.target;
      const targetStr = Array.isArray(target) ? target.join(', ') : target || 'field';
      throw new ConflictError(`Community with this ${targetStr} already exists`, [
        { field: targetStr, message: 'Already exists' },
      ]);
    }
    throw error;
  }
}

/**
 * Retrieves a paginated list of ACTIVE communities with optional domain and name search filtering.
 *
 * 1. Enforces status = 'ACTIVE' so soft-deleted/inactive communities are hidden.
 * 2. Applies optional domain filter (case-insensitive exact match).
 * 3. Applies optional search filter (case-insensitive substring match in community name).
 * 4. Paginates results using skip/take calculated from page and limit.
 * 5. Uses a Prisma transaction to execute count and findMany concurrently.
 * 6. Includes membersCount aggregated from CommunityMembership.
 * 7. Returns formatted communities and standard PaginationMeta.
 */
export async function getCommunities(
  query: CommunityQueryInput
): Promise<PaginatedCommunitiesResult> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.CommunityWhereInput = {
    status: 'ACTIVE',
  };

  if (query.domain && query.domain.trim()) {
    where.domain = {
      equals: query.domain.trim().toLowerCase(),
      mode: 'insensitive',
    };
  }

  if (query.search && query.search.trim()) {
    where.name = {
      contains: query.search.trim(),
      mode: 'insensitive',
    };
  }

  const [total, records] = await prisma.$transaction([
    prisma.community.count({ where }),
    prisma.community.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { members: true },
        },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / limit) || 0;
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const communities: CommunityOutput[] = records.map((record) => ({
    communityId: record.communityId,
    name: record.name,
    domain: record.domain,
    description: record.description,
    status: record.status as 'ACTIVE' | 'INACTIVE',
    createdById: record.createdById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    membersCount: record._count?.members ?? 0,
  }));

  return {
    communities,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    },
  };
}

/**
 * Retrieves the full details of a specific community by its unique UUID.
 *
 * 1. Queries the community by primary key (communityId).
 * 2. Selects only public/safe fields: communityId, name, domain, description, status, createdById, createdAt, updatedAt.
 * 3. Includes creator's public profile (userId, name, email, profileImage), strictly excluding sensitive data (passwordHash, phone, wallet, license).
 * 4. Counts active memberships using Prisma relation _count with status: 'ACTIVE'.
 * 5. Throws NotFoundError if the community does not exist.
 * 6. Returns a structured CommunityDetailOutput representation.
 */
export async function getCommunityById(
  communityId: string
): Promise<CommunityDetailOutput> {
  const community = await prisma.community.findUnique({
    where: { communityId },
    select: {
      communityId: true,
      name: true,
      domain: true,
      description: true,
      status: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          userId: true,
          name: true,
          email: true,
          profileImage: true,
        },
      },
      _count: {
        select: {
          members: {
            where: { status: 'ACTIVE' },
          },
        },
      },
    },
  });

  if (!community) {
    throw new NotFoundError('Community not found');
  }

  return {
    communityId: community.communityId,
    name: community.name,
    domain: community.domain,
    description: community.description,
    status: community.status as 'ACTIVE' | 'INACTIVE',
    createdById: community.createdById,
    createdAt: community.createdAt,
    updatedAt: community.updatedAt,
    membersCount: typeof community._count?.members === 'number' ? community._count.members : 0,
    createdBy: {
      userId: community.createdBy.userId,
      name: community.createdBy.name,
      email: community.createdBy.email,
      profileImage: community.createdBy.profileImage,
    },
  };
}

/**
 * Allows an existing user to join an active community.
 *
 * 1. Verifies that the user exists.
 * 2. Verifies that the community exists.
 * 3. Verifies that the community is ACTIVE (rejects INACTIVE/closed communities).
 * 4. Strictly validates email domain eligibility (case-insensitive exact domain matching).
 * 5. Checks for duplicate membership. Rejects active members with ConflictError; reactivates inactive memberships.
 * 6. Creates a new CommunityMembership with default role 'MEMBER' and status 'ACTIVE'.
 * 7. Wraps the operation inside a Prisma transaction to ensure atomicity.
 * 8. Catches Prisma P2002 unique constraint violations and converts them to ConflictError.
 */
export async function joinCommunity(
  userId: string,
  communityId: string
): Promise<CommunityMembershipOutput> {
  return await prisma.$transaction(async (tx) => {
    // 1. Verify user exists
    const user = await tx.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // 2. Verify community exists
    const community = await tx.community.findUnique({
      where: { communityId },
      select: {
        communityId: true,
        name: true,
        domain: true,
        status: true,
      },
    });

    if (!community) {
      throw new NotFoundError('Community not found');
    }

    // 3. Verify community is active
    if (community.status !== 'ACTIVE') {
      throw new BadRequestError('Community is not active or accepting new members');
    }

    // 4. Verify email domain matches community domain
    const emailParts = user.email.trim().toLowerCase().split('@');
    const userDomain = emailParts.length === 2 ? emailParts[1].trim() : null;
    const communityDomain = community.domain.trim().toLowerCase();

    if (!userDomain || userDomain !== communityDomain) {
      throw new ForbiddenError('User email domain is not eligible for this community');
    }

    // 5. Check existing membership
    const existingMembership = await tx.communityMembership.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId,
        },
      },
    });

    if (existingMembership) {
      if (existingMembership.status === 'ACTIVE') {
        throw new ConflictError('User is already a member of this community');
      }

      // Reactivate inactive membership
      const reactivated = await tx.communityMembership.update({
        where: {
          membershipId: existingMembership.membershipId,
        },
        data: {
          status: 'ACTIVE',
          joinedAt: new Date(),
        },
        select: {
          membershipId: true,
          communityId: true,
          userId: true,
          memberRole: true,
          status: true,
          joinedAt: true,
        },
      });

      return {
        membershipId: reactivated.membershipId,
        communityId: reactivated.communityId,
        userId: reactivated.userId,
        memberRole: reactivated.memberRole as 'MEMBER' | 'ADMIN',
        status: reactivated.status as 'ACTIVE' | 'INACTIVE',
        joinedAt: reactivated.joinedAt,
      };
    }

    // 6. Create new membership
    try {
      const newMembership = await tx.communityMembership.create({
        data: {
          communityId,
          userId,
          memberRole: 'MEMBER',
          status: 'ACTIVE',
        },
        select: {
          membershipId: true,
          communityId: true,
          userId: true,
          memberRole: true,
          status: true,
          joinedAt: true,
        },
      });

      return {
        membershipId: newMembership.membershipId,
        communityId: newMembership.communityId,
        userId: newMembership.userId,
        memberRole: newMembership.memberRole as 'MEMBER' | 'ADMIN',
        status: newMembership.status as 'ACTIVE' | 'INACTIVE',
        joinedAt: newMembership.joinedAt,
      };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictError('User is already a member of this community');
      }
      throw error;
    }
  });
}

export const communityService = {
  createCommunity,
  getCommunities,
  getCommunityById,
  joinCommunity,
};
