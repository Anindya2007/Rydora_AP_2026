import type { Server } from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { prisma, disconnectPrisma } from './config/prisma.js';
import { initSessionTable } from './services/session.service.js';

let server: Server;

async function startServer(): Promise<void> {
  try {
    // 1. Verify Database connectivity on boot
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ PostgreSQL Database connection established via Prisma 7.');

    // 2. Initialize Sessions table and indexes
    await initSessionTable();

    // 3. Start HTTP listener
    server = app.listen(env.PORT, () => {
      console.log(`🚀 Rydora Backend listening on http://localhost:${env.PORT}`);
      console.log(`📡 API v1 Base Route: http://localhost:${env.PORT}/api/v1`);
      console.log(`🩺 Health Probe:     http://localhost:${env.PORT}/api/v1/health`);
      console.log(`🔍 Readiness Probe:  http://localhost:${env.PORT}/api/v1/ready`);
    });
  } catch (error) {
    console.error('❌ Failed to start Rydora server:', error);
    process.exit(1);
  }
}

/**
 * Gracefully shuts down the HTTP server and database connections.
 */
async function handleShutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('🔒 HTTP server closed to new connections.');
      try {
        await disconnectPrisma();
        console.log('📦 Database connections and pool closed.');
        process.exit(0);
      } catch (err) {
        console.error('❌ Error during database disconnection:', err);
        process.exit(1);
      }
    });

    // Force exit if connections take too long to close
    setTimeout(() => {
      console.error('⚠️ Forcefully terminating after timeout.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

/**
 * ============================================================================
 * PROCESS-LEVEL UNHANDLED EXCEPTION & REJECTION GUARDS
 * ============================================================================
 * Any asynchronous background task (e.g. detached SMS notification, payment probe)
 * that fails without an explicit catch block will trigger an 'unhandledRejection'.
 * In modern Node.js runtimes, this would abruptly terminate the whole server.
 * These listeners capture the error, log structured diagnostic output, and keep
 * the application operational or shut down gracefully without crashing mid-request.
 */
process.on('unhandledRejection', (reason: unknown) => {
  console.error('💥 [Server Process] Unhandled Promise Rejection detected:');
  if (reason instanceof Error) {
    console.error(`   Message: ${reason.message}`);
    console.error(`   Stack: ${reason.stack}`);
  } else {
    console.error('   Reason:', reason);
  }
});

process.on('uncaughtException', (error: Error) => {
  console.error('💥 [Server Process] Uncaught Exception occurred:');
  console.error(`   Message: ${error.message}`);
  console.error(`   Stack: ${error.stack}`);
  // Attempt clean teardown before exiting so database connections aren't left hanging
  handleShutdown('uncaughtException');
});

startServer();
