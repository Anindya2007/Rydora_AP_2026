import { describe, it, expect, vi, afterEach } from 'vitest';
import { prisma } from '../../src/config/prisma.js';
import { communityService } from '../../src/services/community.service.js';
import { NotFoundError } from '../../src/utils/errors.js';

describe('Community Service - Listing & Filtering (M3.4)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockCommunityDate = new Date('2026-11-20T10:00:00Z');

  const createMockDbCommunity = (overrides = {}) => ({
    communityId: '11111111-1111-1111-1111-111111111111',
    name: 'SRM Institute of Science and Technology',
    domain: 'srmist.edu.in',
    description: 'Main campus community',
    status: 'ACTIVE' as const,
    createdById: '00000000-0000-0000-0000-000000000000',
    createdAt: mockCommunityDate,
    updatedAt: mockCommunityDate,
    _count: {
      members: 42,
    },
    ...overrides,
  });

  it('should return paginated communities with default page=1 and limit=20', async () => {
    const mockDbRecords = [
      createMockDbCommunity({ communityId: 'comm-1', name: 'SRMIST KTR' }),
      createMockDbCommunity({ communityId: 'comm-2', name: 'SRMIST Ramapuram' }),
    ];

    const transactionSpy = vi
      .spyOn(prisma, '$transaction')
      .mockResolvedValueOnce([2, mockDbRecords] as any);

    const result = await communityService.getCommunities({ page: 1, limit: 20 });

    expect(result.communities).toHaveLength(2);
    expect(result.communities[0]).toEqual({
      communityId: 'comm-1',
      name: 'SRMIST KTR',
      domain: 'srmist.edu.in',
      description: 'Main campus community',
      status: 'ACTIVE',
      createdById: '00000000-0000-0000-0000-000000000000',
      createdAt: mockCommunityDate,
      updatedAt: mockCommunityDate,
      membersCount: 42,
    });

    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });

    expect(transactionSpy).toHaveBeenCalledTimes(1);
  });

  it('should calculate skip and take correctly for custom page and limit', async () => {
    const mockDbRecords = [createMockDbCommunity({ communityId: 'comm-11' })];

    let countArgs: any;
    let findManyArgs: any;

    vi.spyOn(prisma.community, 'count').mockImplementationOnce(async (args) => {
      countArgs = args;
      return 25;
    });

    vi.spyOn(prisma.community, 'findMany').mockImplementationOnce(async (args) => {
      findManyArgs = args;
      return mockDbRecords as any;
    });

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (promises: any) => {
      return Promise.all(promises);
    });

    const result = await communityService.getCommunities({ page: 2, limit: 10 });

    expect(countArgs).toEqual({
      where: { status: 'ACTIVE' },
    });

    expect(findManyArgs).toEqual({
      where: { status: 'ACTIVE' },
      skip: 10,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    });
  });

  it('should accurately compute hasNext=false on the final page', async () => {
    vi.spyOn(prisma, '$transaction').mockResolvedValueOnce([
      25,
      [createMockDbCommunity({ communityId: 'comm-21' })],
    ] as any);

    const result = await communityService.getCommunities({ page: 3, limit: 10 });

    expect(result.pagination).toEqual({
      page: 3,
      limit: 10,
      total: 25,
      totalPages: 3,
      hasNext: false,
      hasPrev: true,
    });
  });

  it('should handle zero results with totalPages=0, hasNext=false, hasPrev=false', async () => {
    vi.spyOn(prisma, '$transaction').mockResolvedValueOnce([0, []] as any);

    const result = await communityService.getCommunities({ page: 1, limit: 20 });

    expect(result.communities).toEqual([]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });

  it('should filter by domain with lowercase normalization and case-insensitive matching', async () => {
    let findManyArgs: any;

    vi.spyOn(prisma.community, 'count').mockResolvedValueOnce(1);
    vi.spyOn(prisma.community, 'findMany').mockImplementationOnce(async (args) => {
      findManyArgs = args;
      return [createMockDbCommunity({ domain: 'iitm.ac.in' })] as any;
    });

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (promises: any) => {
      return Promise.all(promises);
    });

    const result = await communityService.getCommunities({
      page: 1,
      limit: 20,
      domain: '  IITM.AC.IN  ',
    });

    expect(findManyArgs.where).toEqual({
      status: 'ACTIVE',
      domain: {
        equals: 'iitm.ac.in',
        mode: 'insensitive',
      },
    });
    expect(result.communities[0].domain).toBe('iitm.ac.in');
  });

  it('should filter by name using case-insensitive substring search', async () => {
    let findManyArgs: any;

    vi.spyOn(prisma.community, 'count').mockResolvedValueOnce(1);
    vi.spyOn(prisma.community, 'findMany').mockImplementationOnce(async (args) => {
      findManyArgs = args;
      return [createMockDbCommunity({ name: 'BITS Pilani Campus' })] as any;
    });

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (promises: any) => {
      return Promise.all(promises);
    });

    const result = await communityService.getCommunities({
      page: 1,
      limit: 20,
      search: '  Pilani  ',
    });

    expect(findManyArgs.where).toEqual({
      status: 'ACTIVE',
      name: {
        contains: 'Pilani',
        mode: 'insensitive',
      },
    });
    expect(result.communities[0].name).toBe('BITS Pilani Campus');
  });

  it('should combine domain and search filters with status: ACTIVE', async () => {
    let findManyArgs: any;

    vi.spyOn(prisma.community, 'count').mockResolvedValueOnce(1);
    vi.spyOn(prisma.community, 'findMany').mockImplementationOnce(async (args) => {
      findManyArgs = args;
      return [createMockDbCommunity()] as any;
    });

    vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (promises: any) => {
      return Promise.all(promises);
    });

    await communityService.getCommunities({
      page: 1,
      limit: 15,
      domain: 'srmist.edu.in',
      search: 'Technology',
    });

    expect(findManyArgs.where).toEqual({
      status: 'ACTIVE',
      domain: {
        equals: 'srmist.edu.in',
        mode: 'insensitive',
      },
      name: {
        contains: 'Technology',
        mode: 'insensitive',
      },
    });
  });

  it('should default membersCount to 0 when _count or members relation is missing or 0', async () => {
    const mockRecord = createMockDbCommunity();
    delete (mockRecord as any)._count;

    vi.spyOn(prisma, '$transaction').mockResolvedValueOnce([1, [mockRecord]] as any);

    const result = await communityService.getCommunities({ page: 1, limit: 20 });

    expect(result.communities[0].membersCount).toBe(0);
  });

  it('should propagate unexpected database errors as-is', async () => {
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(
      new Error('Database connection failure')
    );

    await expect(
      communityService.getCommunities({ page: 1, limit: 20 })
    ).rejects.toThrow('Database connection failure');
  });
});

describe('Community Service - Community Detail (M3.6: getCommunityById)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockDate = new Date('2026-11-20T10:00:00Z');
  const mockCommunityId = '99999999-8888-7777-6666-555555555555';
  const mockUserId = '11111111-2222-3333-4444-555555555555';

  const createMockDbCommunityDetail = (overrides = {}) => ({
    communityId: mockCommunityId,
    name: 'SRM Institute of Science and Technology',
    domain: 'srmist.edu.in',
    description: 'Official campus carpooling',
    status: 'ACTIVE' as const,
    createdById: mockUserId,
    createdAt: mockDate,
    updatedAt: mockDate,
    createdBy: {
      userId: mockUserId,
      name: 'Badal Khandelwal',
      email: 'badal@srmist.edu.in',
      profileImage: 'https://example.com/avatar.jpg',
    },
    _count: {
      members: 15,
    },
    ...overrides,
  });

  it('should successfully retrieve an existing community by ID and return expected detail structure', async () => {
    const mockDbRecord = createMockDbCommunityDetail();
    vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce(mockDbRecord as any);

    const result = await communityService.getCommunityById(mockCommunityId);

    expect(result).toEqual({
      communityId: mockCommunityId,
      name: 'SRM Institute of Science and Technology',
      domain: 'srmist.edu.in',
      description: 'Official campus carpooling',
      status: 'ACTIVE',
      createdById: mockUserId,
      createdAt: mockDate,
      updatedAt: mockDate,
      membersCount: 15,
      createdBy: {
        userId: mockUserId,
        name: 'Badal Khandelwal',
        email: 'badal@srmist.edu.in',
        profileImage: 'https://example.com/avatar.jpg',
      },
    });
  });

  it('should query Prisma with exact where condition and field selections', async () => {
    let queryArgs: any;
    vi.spyOn(prisma.community, 'findUnique').mockImplementationOnce(async (args) => {
      queryArgs = args;
      return createMockDbCommunityDetail() as any;
    });

    await communityService.getCommunityById(mockCommunityId);

    expect(queryArgs).toEqual({
      where: { communityId: mockCommunityId },
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
  });

  it('should throw NotFoundError when community does not exist', async () => {
    vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce(null);

    await expect(
      communityService.getCommunityById('00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow(NotFoundError);
  });

  it('should return correct public creator info and null profileImage if not set', async () => {
    const mockDbRecord = createMockDbCommunityDetail({
      createdBy: {
        userId: mockUserId,
        name: 'Jane Doe',
        email: 'jane@srmist.edu.in',
        profileImage: null,
      },
    });
    vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce(mockDbRecord as any);

    const result = await communityService.getCommunityById(mockCommunityId);

    expect(result.createdBy).toEqual({
      userId: mockUserId,
      name: 'Jane Doe',
      email: 'jane@srmist.edu.in',
      profileImage: null,
    });
  });

  it('should ensure sensitive user fields are not exposed in output', async () => {
    const mockDbRecord = createMockDbCommunityDetail();
    (mockDbRecord.createdBy as any).passwordHash = '$2b$10$secretpasswordhash';
    (mockDbRecord.createdBy as any).phone = '+919876543210';
    (mockDbRecord.createdBy as any).walletBalance = 1000;
    (mockDbRecord.createdBy as any).licenseNumber = 'DL-123456';

    vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce(mockDbRecord as any);

    const result = await communityService.getCommunityById(mockCommunityId);

    expect((result.createdBy as any).passwordHash).toBeUndefined();
    expect((result.createdBy as any).phone).toBeUndefined();
    expect((result.createdBy as any).walletBalance).toBeUndefined();
    expect((result.createdBy as any).licenseNumber).toBeUndefined();
  });

  it('should default membersCount to 0 when _count or members is missing', async () => {
    const mockDbRecord = createMockDbCommunityDetail();
    delete (mockDbRecord as any)._count;

    vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce(mockDbRecord as any);

    const result = await communityService.getCommunityById(mockCommunityId);

    expect(result.membersCount).toBe(0);
  });

  it('should default membersCount to 0 when _count.members is null or undefined', async () => {
    const mockDbRecord = createMockDbCommunityDetail({
      _count: { members: undefined },
    });

    vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce(mockDbRecord as any);

    const result = await communityService.getCommunityById(mockCommunityId);

    expect(result.membersCount).toBe(0);
  });

  it('should successfully handle a community with null description and INACTIVE status', async () => {
    const mockDbRecord = createMockDbCommunityDetail({
      description: null,
      status: 'INACTIVE',
    });
    vi.spyOn(prisma.community, 'findUnique').mockResolvedValueOnce(mockDbRecord as any);

    const result = await communityService.getCommunityById(mockCommunityId);

    expect(result.description).toBeNull();
    expect(result.status).toBe('INACTIVE');
  });

  it('should propagate unexpected database errors as-is', async () => {
    vi.spyOn(prisma.community, 'findUnique').mockRejectedValueOnce(
      new Error('Neon database unreachable')
    );

    await expect(
      communityService.getCommunityById(mockCommunityId)
    ).rejects.toThrow('Neon database unreachable');
  });
});
