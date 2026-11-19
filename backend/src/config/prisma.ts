import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from './env.js';

const { Pool } = pg;

// Singleton pool instance for PostgreSQL connections
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
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
