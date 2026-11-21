import { describe, it, expect, vi, afterEach } from 'vitest';
import { prisma } from '../../src/config/prisma.js';
import { communityService } from '../../src/services/community.service.js';

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
