import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';
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
 */
export function generateToken(user: { userId: string; email: string; roles: string[] }): string {
  return jwt.sign(
    {
      sub: user.userId,
      email: user.email,
      roles: user.roles,
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

  // 4. Create User in database
  const createdUser = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      roles: ['USER'],
      driverVerified: false,
    },
  });

  // 5. Generate JWT token
  const token = generateToken(createdUser);

  return {
    user: sanitizeUser(createdUser),
    token,
  };
}

/**
 * Handles user login:
 * 1. Normalizes email
 * 2. Queries user by email
 * 3. Verifies password against stored hash
 * 4. Throws generic 401 Unauthorized for both invalid email and password (prevents user enumeration)
 * 5. Issues 24-hour JWT token upon success
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

  const token = generateToken(user);

  return {
    user: sanitizeUser(user),
    token,
  };
}

export const authService = {
  hashPassword,
  comparePassword,
  generateToken,
  sanitizeUser,
  signup,
  login,
};
