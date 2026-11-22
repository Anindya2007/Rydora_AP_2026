import { describe, it, expect, vi, afterEach } from 'vitest';
import { prisma } from '../../src/config/prisma.js';
import { communityService } from '../../src/services/community.service.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../src/utils/errors.js';
import {
  createCommunitySchema,
  communityQuerySchema,
  communityIdParamSchema,
  joinCommunitySchema,
  communityMembersQuerySchema,
} from '../../src/validators/communityValidator.js';

describe('Community Request Validation Schemas (M3.1)', () => {
  describe('1. Community Creation Schema (createCommunitySchema)', () => {
    it('should validate a valid community creation payload with all fields', () => {
      const payload = {
        name: 'SRM Institute of Science and Technology',
        domain: 'srmist.edu.in',
        description: 'Official SRMIST Kattankulathur carpooling community',
      };

      const result = createCommunitySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('SRM Institute of Science and Technology');
        expect(result.data.domain).toBe('srmist.edu.in');
        expect(result.data.description).toBe('Official SRMIST Kattankulathur carpooling community');
      }
    });

    it('should validate a valid community creation payload without description', () => {
      const payload = {
        name: 'IIT Madras Community',
        domain: 'iitm.ac.in',
      };

      const result = createCommunitySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('IIT Madras Community');
        expect(result.data.domain).toBe('iitm.ac.in');
        expect(result.data.description).toBeNull();
      }
    });

    it('should normalize uppercase domain to lowercase', () => {
      const payload = {
        name: 'SRM University AP',
        domain: 'SRMAP.EDU.IN',
      };

      const result = createCommunitySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.domain).toBe('srmap.edu.in');
      }
    });

    it('should trim surrounding whitespace from name, domain, and description', () => {
      const payload = {
        name: '   Anna University Campus   ',
        domain: '   annauniv.edu   ',
        description: '   Campus rides only   ',
      };

      const result = createCommunitySchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Anna University Campus');
        expect(result.data.domain).toBe('annauniv.edu');
        expect(result.data.description).toBe('Campus rides only');
      }
    });

    it('should reject when community name is missing', () => {
      const payload = {
        domain: 'srmist.edu.in',
      };

      const result = createCommunitySchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('name');
      }
    });

    it('should reject when community name is shorter than 2 characters', () => {
      const payload = {
        name: 'A',
        domain: 'srmist.edu.in',
      };

      const result = createCommunitySchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/at least 2 characters/i);
      }
    });

    it('should reject when community name exceeds 150 characters', () => {
      const payload = {
        name: 'A'.repeat(151),
        domain: 'srmist.edu.in',
      };

      const result = createCommunitySchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/not exceed 150 characters/i);
      }
    });

    it('should reject when email domain is missing', () => {
      const payload = {
        name: 'SRMIST Community',
      };

      const result = createCommunitySchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('domain');
      }
    });

    it('should reject malformed email domains (protocol, path, email syntax, single label)', () => {
      const invalidDomains = [
        'http://srmist.edu.in',
        'https://srmist.edu.in',
        'srmist.edu.in/campus',
        'user@srmist.edu.in',
        'srmist',
        'srmist..edu',
        '-srmist.edu',
        'srmist-.edu',
        'srmist .edu',
        'srmist.e',
      ];

      for (const domain of invalidDomains) {
        const result = createCommunitySchema.safeParse({
          name: 'Invalid Domain Community',
          domain,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain('domain');
        }
      }
    });

    it('should reject description exceeding 1000 characters', () => {
      const payload = {
        name: 'SRMIST Community',
        domain: 'srmist.edu.in',
        description: 'X'.repeat(1001),
      };

      const result = createCommunitySchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toMatch(/not exceed 1000 characters/i);
      }
    });

    it('should strictly reject unexpected/injected fields (communityId, createdById, status, userId)', () => {
      const payload = {
        name: 'SRMIST Community',
        domain: 'srmist.edu.in',
        communityId: '11111111-2222-3333-4444-555555555555',
        createdById: '22222222-3333-4444-5555-666666666666',
        status: 'ACTIVE',
        userId: '33333333-4444-5555-6666-777777777777',
      };

      const result = createCommunitySchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorKeys = result.error.issues.map((i) => (i as any).keys || i.path);
        expect(JSON.stringify(errorKeys)).toMatch(/communityId|createdById|status|userId/);
      }
    });
  });

  describe('2. Community Listing & Query Filter Schema (communityQuerySchema)', () => {
    it('should supply default pagination (page=1, limit=20) for empty query', () => {
      const result = communityQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
        expect(result.data.search).toBeUndefined();
        expect(result.data.domain).toBeUndefined();
      }
    });

    it('should successfully parse and coerce valid query string parameters', () => {
      const query = {
        search: '  SRM  ',
        domain: '  SRMIST.EDU.IN  ',
        page: '3',
        limit: '50',
      };

      const result = communityQuerySchema.safeParse(query);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.search).toBe('SRM');
        expect(result.data.domain).toBe('srmist.edu.in');
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject page <= 0 or non-integer', () => {
      expect(communityQuerySchema.safeParse({ page: 0 }).success).toBe(false);
      expect(communityQuerySchema.safeParse({ page: -1 }).success).toBe(false);
      expect(communityQuerySchema.safeParse({ page: 'invalid' }).success).toBe(false);
    });

    it('should reject limit < 1 or limit > 100', () => {
      expect(communityQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
      expect(communityQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
      expect(communityQuerySchema.safeParse({ limit: 'not-a-number' }).success).toBe(false);
    });

    it('should strictly reject unrecognized query filter keys', () => {
      const query = {
        search: 'Tech',
        maliciousParam: 'drop table',
      };

      const result = communityQuerySchema.safeParse(query);
      expect(result.success).toBe(false);
    });
  });

  describe('3. Community ID Parameter Schema (communityIdParamSchema)', () => {
    it('should accept valid UUID community identifiers', () => {
      const validUuids = [
        '123e4567-e89b-12d3-a456-426614174000',
        '22222222-3333-4444-5555-666666666666',
        'abcdefab-cdef-abcd-efab-cdefabcdefab',
      ];

      for (const communityId of validUuids) {
        const result = communityIdParamSchema.safeParse({ communityId });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.communityId).toBe(communityId);
        }
      }
    });

    it('should reject invalid or malformed community ID parameters', () => {
      const invalidIds = [
        '12345',
        'not-a-uuid',
        '123e4567-e89b-12d3-a456-42661417400g', // invalid hex char 'g'
        '123e4567-e89b-12d3-a456',
        '',
      ];

      for (const communityId of invalidIds) {
        const result = communityIdParamSchema.safeParse({ communityId });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toMatch(/valid UUID/i);
        }
      }
    });

    it('should reject extra unrecognized route parameters', () => {
      const result = communityIdParamSchema.safeParse({
        communityId: '123e4567-e89b-12d3-a456-426614174000',
        extraParam: 'unexpected',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('4. Join Community Request Body Schema (joinCommunitySchema)', () => {
    it('should accept an empty request body or undefined for join request', () => {
      expect(joinCommunitySchema.safeParse({}).success).toBe(true);
      expect(joinCommunitySchema.safeParse(undefined).success).toBe(true);
    });

    it('should strictly reject any attempt to pass userId in request body', () => {
      const result = joinCommunitySchema.safeParse({
        userId: '11111111-2222-3333-4444-555555555555',
      });
      expect(result.success).toBe(false);
    });

    it('should strictly reject any attempt to pass memberRole or status in request body', () => {
      const result = joinCommunitySchema.safeParse({
        memberRole: 'ADMIN',
        status: 'ACTIVE',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('5. Community Members Directory Query Schema (communityMembersQuerySchema)', () => {
    it('should provide default pagination (page=1, limit=20) for empty query', () => {
      const result = communityMembersQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should coerce valid numeric strings for page and limit', () => {
      const result = communityMembersQuerySchema.safeParse({
        page: '3',
        limit: '50',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should reject non-positive or non-integer page', () => {
      expect(communityMembersQuerySchema.safeParse({ page: 0 }).success).toBe(false);
      expect(communityMembersQuerySchema.safeParse({ page: -1 }).success).toBe(false);
      expect(communityMembersQuerySchema.safeParse({ page: 1.5 }).success).toBe(false);
      expect(communityMembersQuerySchema.safeParse({ page: 'abc' }).success).toBe(false);
    });

    it('should reject limit < 1 or limit > 100', () => {
      expect(communityMembersQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
      expect(communityMembersQuerySchema.safeParse({ limit: -10 }).success).toBe(false);
      expect(communityMembersQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
      expect(communityMembersQuerySchema.safeParse({ limit: 'hundred' }).success).toBe(false);
    });

    it('should strictly reject unauthorized query keys (e.g. status, role, search)', () => {
      expect(
        communityMembersQuerySchema.safeParse({ status: 'ACTIVE' }).success
      ).toBe(false);
      expect(
        communityMembersQuerySchema.safeParse({ role: 'ADMIN' }).success
      ).toBe(false);
      expect(
        communityMembersQuerySchema.safeParse({ search: 'query' }).success
      ).toBe(false);
      expect(
        communityMembersQuerySchema.safeParse({ unexpected: 'value' }).success
      ).toBe(false);
    });
  });

  describe('6. Community Creation Service (M3.2 - communityService.createCommunity)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const mockUserId = '11111111-2222-3333-4444-555555555555';
    const mockCommunityId = '99999999-8888-7777-6666-555555555555';

    const mockCreator = {
      userId: mockUserId,
      email: 'badal@srmist.edu.in',
    };

    const mockCreatedCommunity = {
      communityId: mockCommunityId,
      name: 'SRM Institute of Science and Technology',
      domain: 'srmist.edu.in',
      description: 'Official campus carpooling',
      status: 'ACTIVE',
      createdById: mockUserId,
      createdAt: new Date('2026-11-21T10:00:00.000Z'),
      updatedAt: new Date('2026-11-21T10:00:00.000Z'),
    };

    const mockMembership = {
      membershipId: '77777777-6666-5555-4444-333333333333',
      communityId: mockCommunityId,
      userId: mockUserId,
      memberRole: 'ADMIN',
      status: 'ACTIVE',
      joinedAt: new Date('2026-11-21T10:00:00.000Z'),
    };

    it('should successfully create community and creator ADMIN membership within a transaction', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockCreator as any);
      vi.spyOn(prisma.community, 'findFirst').mockResolvedValueOnce(null);

      const mockCommunityCreate = vi.fn().mockResolvedValueOnce(mockCreatedCommunity);
      const mockMembershipCreate = vi.fn().mockResolvedValueOnce(mockMembership);

      vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (callback: any) => {
        return callback({
          community: { create: mockCommunityCreate },
          communityMembership: { create: mockMembershipCreate },
        });
      });

      const result = await communityService.createCommunity(mockUserId, {
        name: 'SRM Institute of Science and Technology',
        domain: 'srmist.edu.in',
        description: 'Official campus carpooling',
      });

      expect(result).toBeDefined();
      expect(result.communityId).toBe(mockCommunityId);
      expect(result.name).toBe('SRM Institute of Science and Technology');
      expect(result.domain).toBe('srmist.edu.in');
      expect(result.status).toBe('ACTIVE');
      expect(result.createdById).toBe(mockUserId);
      expect(result.membersCount).toBe(1);

      expect(mockCommunityCreate).toHaveBeenCalledWith({
        data: {
          name: 'SRM Institute of Science and Technology',
          domain: 'srmist.edu.in',
          description: 'Official campus carpooling',
          status: 'ACTIVE',
          createdById: mockUserId,
        },
      });

      expect(mockMembershipCreate).toHaveBeenCalledWith({
        data: {
          communityId: mockCommunityId,
          userId: mockUserId,
          memberRole: 'ADMIN',
          status: 'ACTIVE',
        },
      });
    });

    it('should throw NotFoundError if creator user does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(null);

      await expect(
        communityService.createCommunity('00000000-0000-0000-0000-000000000000', {
          name: 'IIT Madras',
          domain: 'iitm.ac.in',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if a community with the same domain already exists', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockCreator as any);
      vi.spyOn(prisma.community, 'findFirst').mockResolvedValueOnce({
        communityId: 'existing-id',
        domain: 'srmist.edu.in',
        name: 'Different Name',
      } as any);

      await expect(
        communityService.createCommunity(mockUserId, {
          name: 'New SRM Community',
          domain: 'srmist.edu.in',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError if a community with the same name already exists', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockCreator as any);
      vi.spyOn(prisma.community, 'findFirst').mockResolvedValueOnce({
        communityId: 'existing-id',
        domain: 'other.edu.in',
        name: 'SRM Institute of Science and Technology',
      } as any);

      await expect(
        communityService.createCommunity(mockUserId, {
          name: 'SRM Institute of Science and Technology',
          domain: 'newdomain.edu.in',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should handle Prisma P2002 unique constraint violations and map to ConflictError', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockCreator as any);
      vi.spyOn(prisma.community, 'findFirst').mockResolvedValueOnce(null);

      const p2002Error: any = new Error('Unique constraint failed');
      p2002Error.code = 'P2002';
      p2002Error.meta = { target: ['domain'] };

      vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(p2002Error);

      await expect(
        communityService.createCommunity(mockUserId, {
          name: 'SRM Institute of Science and Technology',
          domain: 'srmist.edu.in',
        })
      ).rejects.toThrow(ConflictError);
    });

    it('should propagate unexpected database errors as-is', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce(mockCreator as any);
      vi.spyOn(prisma.community, 'findFirst').mockResolvedValueOnce(null);

      vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('PostgreSQL connection drop'));

      await expect(
        communityService.createCommunity(mockUserId, {
          name: 'SRM Institute of Science and Technology',
          domain: 'srmist.edu.in',
        })
      ).rejects.toThrow('PostgreSQL connection drop');
    });
  });

  describe('6. Community Membership Join Service (M3.8 - communityService.joinCommunity)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const mockJoinUserId = '22222222-3333-4444-5555-666666666666';
    const mockJoinCommunityId = '99999999-8888-7777-6666-555555555555';
    const mockMembershipId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const mockJoinDate = new Date('2026-11-22T03:00:00.000Z');

    const mockEligibleUser = {
      userId: mockJoinUserId,
      email: 'student@srmist.edu.in',
    };

    const mockActiveCommunity = {
      communityId: mockJoinCommunityId,
      name: 'SRM Institute of Science and Technology',
      domain: 'srmist.edu.in',
      status: 'ACTIVE' as const,
    };

    const mockCreatedMembership = {
      membershipId: mockMembershipId,
      communityId: mockJoinCommunityId,
      userId: mockJoinUserId,
      memberRole: 'MEMBER' as const,
      status: 'ACTIVE' as const,
      joinedAt: mockJoinDate,
    };

    it('1. should successfully join an active community when user has eligible domain', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockEligibleUser as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValue(mockActiveCommunity as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue(null);
      const createSpy = vi
        .spyOn(prisma.communityMembership, 'create')
        .mockResolvedValueOnce(mockCreatedMembership as any);

      const result = await communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId);

      expect(result).toEqual({
        membershipId: mockMembershipId,
        communityId: mockJoinCommunityId,
        userId: mockJoinUserId,
        memberRole: 'MEMBER',
        status: 'ACTIVE',
        joinedAt: mockJoinDate,
      });

      expect(createSpy).toHaveBeenCalledWith({
        data: {
          communityId: mockJoinCommunityId,
          userId: mockJoinUserId,
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
    });

    it('2. should throw NotFoundError when user does not exist', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        communityService.joinCommunity('00000000-0000-0000-0000-000000000000', mockJoinCommunityId)
      ).rejects.toThrow(NotFoundError);
      await expect(
        communityService.joinCommunity('00000000-0000-0000-0000-000000000000', mockJoinCommunityId)
      ).rejects.toThrow('User not found');
    });

    it('3. should throw NotFoundError when community does not exist', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockEligibleUser as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValue(null);

      await expect(
        communityService.joinCommunity(mockJoinUserId, '00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow(NotFoundError);
      await expect(
        communityService.joinCommunity(mockJoinUserId, '00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Community not found');
    });

    it('4. should throw BadRequestError when community status is INACTIVE', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockEligibleUser as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValue({
        ...mockActiveCommunity,
        status: 'INACTIVE',
      } as any);

      await expect(
        communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId)
      ).rejects.toThrow(BadRequestError);
      await expect(
        communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId)
      ).rejects.toThrow('Community is not active or accepting new members');
    });

    it('5. should throw ForbiddenError when user email domain does not match community domain', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        userId: mockJoinUserId,
        email: 'attacker@gmail.com',
      } as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValue(mockActiveCommunity as any);

      await expect(
        communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId)
      ).rejects.toThrow(ForbiddenError);
      await expect(
        communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId)
      ).rejects.toThrow('User email domain is not eligible for this community');
    });

    it('6. should match email domains case-insensitively', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        userId: mockJoinUserId,
        email: 'Student@SRMIST.EDU.IN',
      } as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValue({
        ...mockActiveCommunity,
        domain: 'srmist.edu.in',
      } as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.communityMembership, 'create').mockResolvedValueOnce(mockCreatedMembership as any);

      const result = await communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId);
      expect(result.membershipId).toBe(mockMembershipId);
    });

    it('7. should reject similar looking but non-matching email domains (no loose substring matching)', async () => {
      const nonMatchingEmails = [
        'student@not-srmist.edu.in',
        'student@srmist.edu.in.attacker.org',
        'student@fake-srmist.edu.in',
        'student@srmist.edu',
        'student@srmist_edu.in',
      ];

      for (const email of nonMatchingEmails) {
        vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
          userId: mockJoinUserId,
          email,
        } as any);
        vi.spyOn(prisma.community, 'findUnique').mockResolvedValue(mockActiveCommunity as any);

        await expect(
          communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId)
        ).rejects.toThrow(ForbiddenError);
      }
    });

    it('8. should throw ConflictError when user is already an ACTIVE member', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockEligibleUser as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValue(mockActiveCommunity as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue({
        membershipId: 'existing-id',
        status: 'ACTIVE',
        memberRole: 'MEMBER',
      } as any);

      await expect(
        communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId)
      ).rejects.toThrow(ConflictError);
      await expect(
        communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId)
      ).rejects.toThrow('User is already a member of this community');
    });

    it('9. should preserve creator ADMIN role and prevent privilege downgrade on repeated join', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockEligibleUser as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValue(mockActiveCommunity as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue({
        membershipId: 'creator-membership-id',
        status: 'ACTIVE',
        memberRole: 'ADMIN',
      } as any);

      const createSpy = vi.spyOn(prisma.communityMembership, 'create');
      const updateSpy = vi.spyOn(prisma.communityMembership, 'update');

      await expect(
        communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId)
      ).rejects.toThrow(ConflictError);

      expect(createSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('10. should reactivate membership when previous membership was INACTIVE', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockEligibleUser as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValue(mockActiveCommunity as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue({
        membershipId: 'inactive-id',
        status: 'INACTIVE',
        memberRole: 'MEMBER',
      } as any);

      const updateSpy = vi.spyOn(prisma.communityMembership, 'update').mockResolvedValueOnce({
        membershipId: 'inactive-id',
        communityId: mockJoinCommunityId,
        userId: mockJoinUserId,
        memberRole: 'MEMBER',
        status: 'ACTIVE',
        joinedAt: mockJoinDate,
      } as any);

      const result = await communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId);

      expect(result.status).toBe('ACTIVE');
      expect(updateSpy).toHaveBeenCalledWith({
        where: { membershipId: 'inactive-id' },
        data: {
          status: 'ACTIVE',
          joinedAt: expect.any(Date),
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
    });

    it('11. should handle Prisma P2002 race condition on concurrent join attempts', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(prisma));
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockEligibleUser as any);
      vi.spyOn(prisma.community, 'findUnique').mockResolvedValue(mockActiveCommunity as any);
      vi.spyOn(prisma.communityMembership, 'findUnique').mockResolvedValue(null);

      const p2002Error: any = new Error('Unique constraint failed on community_memberships');
      p2002Error.code = 'P2002';
      vi.spyOn(prisma.communityMembership, 'create').mockRejectedValue(p2002Error);

      await expect(
        communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId)
      ).rejects.toThrow(ConflictError);
      await expect(
        communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId)
      ).rejects.toThrow('User is already a member of this community');
    });

    it('12. should propagate unexpected database errors as-is', async () => {
      vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(
        new Error('PostgreSQL deadlock error')
      );

      await expect(
        communityService.joinCommunity(mockJoinUserId, mockJoinCommunityId)
      ).rejects.toThrow('PostgreSQL deadlock error');
    });
  });
});
