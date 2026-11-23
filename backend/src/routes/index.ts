import { Router } from 'express';
import { prisma } from '../config/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { authRouter } from './auth.routes.js';
import { userRouter } from './user.routes.js';
import { communityRouter } from './community.routes.js';
import { vehicleRouter } from './vehicle.routes.js';
import { rideRouter } from './ride.routes.js';
import { bookingRouter } from './booking.routes.js';
import { emergencyContactRouter } from './emergency-contact.routes.js';

export const apiV1Router = Router();

/**
 * GET /api/v1/health
 * Liveness Probe: Confirms that the Express process is running.
 */
apiV1Router.get('/health', (req, res) => {
  return sendSuccess(
    res,
    {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'rydora-backend',
    },
    'Service is healthy'
  );
});

/**
 * GET /api/v1/ready
 * Readiness Probe: Confirms database connectivity via Prisma Client.
 */
apiV1Router.get('/ready', async (req, res) => {
  try {
    // Lightweight probe against PostgreSQL
    await prisma.$queryRaw`SELECT 1`;

    return sendSuccess(
      res,
      {
        status: 'READY',
        database: 'CONNECTED',
      },
      'Database is connected and ready'
    );
  } catch (error) {
    const requestId = req.id || (res.locals?.requestId as string) || 'unknown';
    return res.status(503).json({
      success: false,
      statusCode: 503,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database connection failed or is not ready',
        details: null,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/*
 * ========================================================================
 * DOMAIN ROUTER MOUNTING REGISTRY
 * ========================================================================
 * As feature milestones are completed, each developer exports their router.
 * Anindya (Lead Architect) will register them here:
 *
 * Anindya (Fleet & Rides):
 *   // apiV1Router.use('/vehicles', vehicleRouter);
 *   // apiV1Router.use('/rides', rideRouter);
 *
 * Athar (Bookings, Cancellations, Transactions):
 *   // apiV1Router.use('/bookings', bookingRouter);
 *   // apiV1Router.use('/cancellations', cancellationRouter);
 *   // apiV1Router.use('/transactions', transactionRouter);
 *
 * Anshika (Emergency Contacts, SOS, Driver Earnings):
 *   // apiV1Router.use('/emergency-contacts', emergencyContactRouter);
 *   // apiV1Router.use('/sos', sosRouter);
 *   // apiV1Router.use('/driver-earnings', driverEarningRouter);
 * ========================================================================
 */

// Badal (Identity, Auth, Communities):
apiV1Router.use('/auth', authRouter);
apiV1Router.use('/users', userRouter);
apiV1Router.use('/communities', communityRouter);

// Fleet & Vehicles (M5):
apiV1Router.use('/vehicles', vehicleRouter);

// Rides Management (M6):
apiV1Router.use('/rides', rideRouter);

// Bookings Management (M7):
apiV1Router.use('/bookings', bookingRouter);

// Safety & Emergency Contacts (M8.1):
apiV1Router.use('/emergency-contacts', emergencyContactRouter);
