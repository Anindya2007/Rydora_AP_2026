import { describe, it, expect, vi, afterEach } from 'vitest';
import { prisma } from '../../src/config/prisma.js';
import { communityService } from '../../src/services/community.service.js';
import { ConflictError, NotFoundError } from '../../src/utils/errors.js';
import {
  createCommunitySchema,
  communityQuerySchema,
  communityIdParamSchema,
  joinCommunitySchema,
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

  describe('5. Community Creation Service (M3.2 - communityService.createCommunity)', () => {
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
});
