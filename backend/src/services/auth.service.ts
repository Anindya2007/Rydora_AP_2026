import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';
import { sessionService } from './session.service.js';
import type { SignupInput, LoginInput } from '../validators/authValidator.js';

export const BCRYPT_SALT_ROUNDS = 10;
export const JWT_EXPIRY = '24h';

export interface SanitizedUser {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  roles: string[];
  profileImage: string | null;
  driverVerified: boolean;
  walletBalance: string;
  averageRating: string;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  user: SanitizedUser;
  token: string;
  sessionId: string;
}

/**
 * Hashes a plaintext password using bcryptjs with 10 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Compares a candidate plaintext password against a stored bcrypt hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates a stateless 24-hour JSON Web Token (JWT) with user ID as `sub`.
 * Strictly restricts the payload to only `sub: user.userId` (no email or roles).
 */
export function generateToken(user: { userId: string }): string {
  return jwt.sign(
    {
      sub: user.userId,
    },
    env.JWT_SECRET,
    {
      expiresIn: JWT_EXPIRY,
    }
  );
}

/**
 * Strips passwordHash and transforms Decimal values into strings for safe JSON serialization.
 */
export function sanitizeUser(user: {
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  roles: string[];
  profileImage?: string | null;
  driverVerified: boolean;
  walletBalance: unknown;
  averageRating: unknown;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
  passwordHash?: string;
}): SanitizedUser {
  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    roles: user.roles,
    profileImage: user.profileImage ?? null,
    driverVerified: user.driverVerified,
    walletBalance: typeof user.walletBalance === 'object' && user.walletBalance !== null && 'toString' in user.walletBalance
      ? user.walletBalance.toString()
      : String(user.walletBalance ?? '0.00'),
    averageRating: typeof user.averageRating === 'object' && user.averageRating !== null && 'toString' in user.averageRating
      ? user.averageRating.toString()
      : String(user.averageRating ?? '0.00'),
    ratingCount: user.ratingCount,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export interface DomainCommunityInfo {
  name: string;
  domain: string;
  isOpenCategory: boolean;
}

/**
 * Detects whether the email belongs to a public consumer domain (Gmail/Yahoo)
 * or a dedicated institutional domain (e.g. Rishihood, college, or company).
 */
export function extractOrganizationCommunityInfo(email: string): DomainCommunityInfo | null {
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return null;
  const rawDomain = parts[1].trim();

  // 1. Gmail and Yahoo emails go directly to Open Category (Open Community)
  const isGmailOrYahoo =
    rawDomain === 'gmail.com' ||
    rawDomain === 'googlemail.com' ||
    rawDomain === 'yahoo.com' ||
    rawDomain.startsWith('yahoo.');

  if (isGmailOrYahoo) {
    return {
      name: 'Open Community',
      domain: 'open',
      isOpenCategory: true,
    };
  }

  // 2. Rishihood University institutional campus network
  if (rawDomain.includes('rishihood.edu.in')) {
    return {
      name: 'Rishihood',
      domain: 'rishihood.edu.in',
      isOpenCategory: false,
    };
  }

  // 3. Any other organization or campus domain
  // Extract a clean name from the domain (e.g. 'nst' -> 'NST', 'microsoft' -> 'Microsoft')
  const primaryName = rawDomain.split('.')[0];
  const formattedName =
    primaryName.length <= 4
      ? primaryName.toUpperCase()
      : primaryName.charAt(0).toUpperCase() + primaryName.slice(1);

  return {
    name: formattedName || rawDomain,
    domain: rawDomain,
    isOpenCategory: false,
  };
}

/**
 * Assigns or creates a community for the user based on their email domain:
 * - If gmail.com or yahoo.com: assigns to "Open Community".
 * - If anything else: assigns to a community named after that domain.
 */
export async function ensureUserDomainCommunity(userId: string, email: string): Promise<void> {
  const orgInfo = extractOrganizationCommunityInfo(email);
  if (!orgInfo) return;

  try {
    // 1. Find existing community
    let community = await prisma.community.findFirst({
      where: orgInfo.isOpenCategory
        ? {
            OR: [
              { name: { equals: 'Open Community', mode: 'insensitive' } },
              { domain: { in: ['open', 'open.rydora.com', 'gmail.com'] } },
            ],
          }
        : {
            OR: [
              { domain: { equals: orgInfo.domain, mode: 'insensitive' } },
              { domain: { equals: email.split('@')[1]?.toLowerCase(), mode: 'insensitive' } },
              { name: { equals: orgInfo.name, mode: 'insensitive' } },
            ],
          },
    });

    // 2. Create community if it doesn't exist yet
    if (!community) {
      community = await prisma.community.create({
        data: {
          name: orgInfo.name,
          domain: orgInfo.domain,
          description: orgInfo.isOpenCategory
            ? 'Open Carpool Community for verified public riders and drivers'
            : `${orgInfo.name} Verified Community Network`,
          status: 'ACTIVE',
          createdById: userId,
        },
      });
    }

    // 3. Give user active membership
    await prisma.communityMembership.upsert({
      where: {
        communityId_userId: {
          communityId: community.communityId,
          userId,
        },
      },
      update: {
        status: 'ACTIVE',
      },
      create: {
        communityId: community.communityId,
        userId,
        memberRole: community.createdById === userId ? 'ADMIN' : 'MEMBER',
        status: 'ACTIVE',
      },
    });
  } catch (err) {
    console.warn('ensureUserDomainCommunity notice:', err);
  }
}

/**
 * Handles new user registration:
 * 1. Normalizes email (trim and lowercase)
 * 2. Checks duplicate email and phone
 * 3. Hashes password using bcryptjs (10 rounds)
 * 4. Creates user record with default 'USER' role
 * 5. Issues 24-hour JWT token
 */
export async function signup(input: SignupInput): Promise<AuthResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone && input.phone.trim() ? input.phone.trim() : null;

  // 1. Check duplicate email
  const existingEmailUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { userId: true },
  });

  if (existingEmailUser) {
    throw new ConflictError('User with this email already exists', [
      { field: 'email', message: 'Email is already registered' },
    ]);
  }

  // 2. Check duplicate phone if provided
  if (normalizedPhone) {
    const existingPhoneUser = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: { userId: true },
    });

    if (existingPhoneUser) {
      throw new ConflictError('User with this phone number already exists', [
        { field: 'phone', message: 'Phone number is already registered' },
      ]);
    }
  }

  // 3. Hash password
  const passwordHash = await hashPassword(input.password);

  // 4. Create User in database (with atomic race-condition P2002 protection)
  let createdUser;
  try {
    createdUser = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        roles: ['USER'],
        driverVerified: false,
      },
    });
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

  // 4b. Auto-create or affiliate with community if non-generic domain
  await ensureUserDomainCommunity(createdUser.userId, normalizedEmail);

  // 5. Generate JWT token and persist session in sessions table
  const token = generateToken(createdUser);
  const sessionId = await sessionService.createSession(createdUser.userId, token);

  return {
    user: sanitizeUser(createdUser),
    token,
    sessionId,
  };
}

/**
 * Handles user login:
 * 1. Normalizes email
 * 2. Queries user by email
 * 3. Verifies password against stored hash
 * 4. Throws generic 401 Unauthorized for both invalid email and password (prevents user enumeration)
 * 5. Issues 24-hour JWT token and records session in sessions table
 */
export async function login(input: LoginInput): Promise<AuthResult> {
  const normalizedEmail = input.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Generic failure message to prevent email enumeration attacks
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isPasswordValid = await comparePassword(input.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // 4c. Auto-create or affiliate with community on login
  await ensureUserDomainCommunity(user.userId, normalizedEmail);

  const token = generateToken(user);
  const sessionId = await sessionService.createSession(user.userId, token);

  return {
    user: sanitizeUser(user),
    token,
    sessionId,
  };
}

export const authService = {
  hashPassword,
  comparePassword,
  generateToken,
  sanitizeUser,
  extractOrganizationCommunityInfo,
  ensureUserDomainCommunity,
  signup,
  login,
};
