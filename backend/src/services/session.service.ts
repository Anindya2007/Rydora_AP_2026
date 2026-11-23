import { randomUUID } from 'node:crypto';
import { pool } from '../config/prisma.js';

export interface SessionRecord {
  sessionId: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// In-memory cache fallback for high-throughput and resiliency
const memorySessions = new Map<string, SessionRecord>();

/**
 * Initializes the PostgreSQL `sessions` table and indexes.
 * Called during application boot to guarantee the table exists without altering Prisma schema migrations.
 */
export async function initSessionTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `);
    console.log('✅ [Sessions] Database session table and indexes verified.');
  } catch (err: any) {
    console.warn('⚠️ [Sessions] Notice while verifying sessions table in PostgreSQL:', err?.message || err);
  }
}

/**
 * Creates a new authenticated session in the `sessions` table and memory cache.
 */
export async function createSession(
  userId: string,
  token: string,
  expiryMs = 24 * 60 * 60 * 1000
): Promise<string> {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + expiryMs);

  const session: SessionRecord = {
    sessionId,
    userId,
    token,
    expiresAt,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Sync to memory store
  memorySessions.set(sessionId, session);

  // Persist to PostgreSQL sessions table
  try {
    await pool.query(
      `
      INSERT INTO sessions (session_id, user_id, token, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (session_id) DO UPDATE
      SET token = $3, expires_at = $4, updated_at = NOW();
      `,
      [sessionId, userId, token, expiresAt]
    );
  } catch (err: any) {
    console.warn('⚠️ [Sessions] Failed to insert session into database, memory fallback active:', err?.message);
  }

  return sessionId;
}

/**
 * Retrieves a session by its sessionId and verifies it has not expired.
 */
export async function getSession(sessionId: string): Promise<SessionRecord | null> {
  if (!sessionId) return null;

  // 1. Try querying PostgreSQL sessions table
  try {
    const res = await pool.query(
      `
      SELECT session_id AS "sessionId", user_id AS "userId", token, expires_at AS "expiresAt"
      FROM sessions
      WHERE session_id = $1 AND expires_at > NOW()
      LIMIT 1;
      `,
      [sessionId]
    );

    if (res.rows && res.rows.length > 0) {
      const row = res.rows[0];
      const record: SessionRecord = {
        sessionId: row.sessionId,
        userId: row.userId,
        token: row.token,
        expiresAt: new Date(row.expiresAt),
      };
      memorySessions.set(sessionId, record);
      return record;
    }
  } catch (err: any) {
    console.warn('⚠️ [Sessions] Failed to query session from database, checking memory cache:', err?.message);
  }

  // 2. Fallback to memory cache
  const cached = memorySessions.get(sessionId);
  if (cached) {
    if (new Date(cached.expiresAt).getTime() > Date.now()) {
      return cached;
    }
    memorySessions.delete(sessionId);
  }

  return null;
}

/**
 * Stores or refreshes the session token for an active session.
 */
export async function storeSessionToken(
  sessionId: string,
  token: string,
  userId: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const existing = memorySessions.get(sessionId);
  if (existing) {
    existing.token = token;
    existing.expiresAt = expiresAt;
    existing.updatedAt = new Date();
  } else {
    memorySessions.set(sessionId, {
      sessionId,
      userId,
      token,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  try {
    await pool.query(
      `
      INSERT INTO sessions (session_id, user_id, token, expires_at, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      ON CONFLICT (session_id) DO UPDATE
      SET token = $3, expires_at = $4, updated_at = NOW();
      `,
      [sessionId, userId, token, expiresAt]
    );
  } catch (err: any) {
    console.warn('⚠️ [Sessions] Failed to update session token in database:', err?.message);
  }
}

/**
 * Finds or creates a session record for a verified token and userId.
 */
export async function getOrCreateSessionForToken(
  userId: string,
  token: string
): Promise<string> {
  // Check if token already exists in database
  try {
    const res = await pool.query(
      `
      SELECT session_id AS "sessionId"
      FROM sessions
      WHERE token = $1 AND user_id = $2 AND expires_at > NOW()
      LIMIT 1;
      `,
      [token, userId]
    );

    if (res.rows && res.rows.length > 0) {
      return res.rows[0].sessionId;
    }
  } catch {}

  // Otherwise create a new session
  return createSession(userId, token);
}

/**
 * Deletes a session from both database and memory cache.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  memorySessions.delete(sessionId);

  try {
    await pool.query('DELETE FROM sessions WHERE session_id = $1;', [sessionId]);
  } catch (err: any) {
    console.warn('⚠️ [Sessions] Failed to delete session from database:', err?.message);
  }
}

/**
 * Deletes all sessions belonging to a specific user (e.g. On password reset / account revoke).
 */
export async function deleteUserSessions(userId: string): Promise<void> {
  if (!userId) return;

  for (const [sId, s] of memorySessions.entries()) {
    if (s.userId === userId) {
      memorySessions.delete(sId);
    }
  }

  try {
    await pool.query('DELETE FROM sessions WHERE user_id = $1;', [userId]);
  } catch (err: any) {
    console.warn('⚠️ [Sessions] Failed to delete user sessions from database:', err?.message);
  }
}

export const sessionService = {
  initSessionTable,
  createSession,
  getSession,
  storeSessionToken,
  getOrCreateSessionForToken,
  deleteSession,
  deleteUserSessions,
};
