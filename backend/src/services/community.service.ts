import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
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

export const communityService = {
  createCommunity,
  getCommunities,
};
