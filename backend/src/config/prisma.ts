import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from './env.js';

const { Pool } = pg;

/**
 * ============================================================================
 * DATABASE CONNECTION POOL SETUP (PostgreSQL via node-postgres & Prisma 7)
 * ============================================================================
 * We create a single shared connection pool for all database interactions.
 * In production or cloud environments (like Neon serverless PostgreSQL),
 * database connections that stay idle can be terminated by the server.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

/**
 * CRITICAL PROCESS STABILITY FIX:
 * By default in Node.js, if an EventEmitter emits an 'error' event and there
 * is no listener, Node treats it as an unhandled exception and crashes the process.
 * When Neon closes an idle pooled connection, pg emits an 'error' on the pool.
 * This listener catches and logs that idle drop safely without crashing the server.
 */
pool.on('error', (err: Error) => {
  console.warn(
    '⚠️ [PostgreSQL Pool] An idle database connection was dropped by the server (normal for serverless/Neon):',
    err.message
  );
});

const adapter = new PrismaPg(pool);

// Declare global type to attach singleton in development hot-reloading
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnects Prisma client and drains the PostgreSQL connection pool.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
}

