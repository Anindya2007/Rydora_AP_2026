import { prisma } from '../config/prisma.js';
import {
  SOSAlertStatus,
  BookingStatus,
} from '../generated/prisma/client.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import type { PaginationMeta } from '../utils/response.js';
import type {
  CreateSOSAlertInput,
  ListSOSAlertsQueryInput,
} from '../validators/sos.validator.js';
import {
  emergencyContactSelectProjection,
  type EmergencyContactOutput,
} from './emergency-contact.service.js';
import {
  emergencyNotificationService,
  type SOSNotificationOutput,
} from './emergency-notification.service.js';

export interface SOSAlertOutput {
  alertId: string;
  userId: string;
  rideId: string | null;
  message: string | null;
  latitude: string | null;
  longitude: string | null;
  status: SOSAlertStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}

export interface RideSummary {
  rideId: string;
  source: string;
  destination: string;
  status: string;
}

export interface SOSAlertDetailOutput {
  alert: SOSAlertOutput;
  contacts: EmergencyContactOutput[];
  ride?: RideSummary | null;
  notifications?: SOSNotificationOutput[];
}

export const sosAlertSelectProjection = {
  alertId: true,
  userId: true,
  rideId: true,
  message: true,
  latitude: true,
  longitude: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
};

/**
 * Format raw database SOSAlert row into sanitized output DTO.
 */
export function formatSOSAlert(raw: {
  alertId: string;
  userId: string;
  rideId: string | null;
  message: string | null;
  latitude: any;
  longitude: any;
  status: SOSAlertStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}): SOSAlertOutput {
  return {
    alertId: raw.alertId,
    userId: raw.userId,
    rideId: raw.rideId,
    message: raw.message,
    latitude:
      raw.latitude !== null && raw.latitude !== undefined
        ? raw.latitude.toString()
        : null,
    longitude:
      raw.longitude !== null && raw.longitude !== undefined
        ? raw.longitude.toString()
        : null,
    status: raw.status,
    createdAt: raw.createdAt,
    resolvedAt: raw.resolvedAt,
  };
}

/**
 * Activates an emergency SOS alert for the authenticated user.
 *
 * Rules & Invariants:
 * 1. User isolation: Derives userId strictly from authenticated context.
 * 2. Serialization: Uses a PostgreSQL row lock (`FOR UPDATE`) on the user row to prevent
 *    concurrent duplicate active alerts for the same user.
 * 3. Duplicate prevention: Rejects activation if the user already has an ACTIVE SOS alert.
 * 4. Ride participation check: If `rideId` is provided, ensures ride exists and the user
 *    is either the driver or a confirmed/pending passenger on that ride.
 * 5. Emergency contacts context: Retrieves and attaches the user's emergency contacts
 *    to the response payload for immediate dispatch visibility.
 */
export async function createSOSAlert(
  userId: string,
  input: CreateSOSAlertInput
): Promise<SOSAlertDetailOutput> {
  const created = await prisma.$transaction(async (tx) => {
    // 1. Acquire row lock on user row to serialize concurrent SOS activations
    await tx.$queryRaw`SELECT 1 FROM "users" WHERE "user_id" = ${userId}::uuid FOR UPDATE`;

    // 2. Prevent duplicate active alerts
    const existingActive = await tx.sOSAlert.findFirst({
      where: {
        userId,
        status: SOSAlertStatus.ACTIVE,
      },
    });

    if (existingActive) {
      throw new ConflictError(
        'An active SOS alert is already open for your account'
      );
    }

    // 3. Optional ride validation
    let rideSummary: RideSummary | null = null;
    if (input.rideId) {
      const ride = await tx.ride.findUnique({
        where: { rideId: input.rideId },
        include: {
          bookings: {
            where: {
              riderId: userId,
              status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
            },
          },
        },
      });

      if (!ride) {
        throw new NotFoundError('Ride not found');
      }

      if (ride.status === 'CANCELLED') {
        throw new BadRequestError('Cannot link an SOS alert to a cancelled ride');
      }

      if (ride.status === 'COMPLETED') {
        throw new BadRequestError('Cannot link an SOS alert to a completed ride');
      }

      const isDriver = ride.driverId === userId;
      const isRider = ride.bookings.length > 0;

      if (!isDriver && !isRider) {
        throw new BadRequestError(
          'User is not a participant in the specified ride'
        );
      }

      rideSummary = {
        rideId: ride.rideId,
        source: ride.source,
        destination: ride.destination,
        status: ride.status,
      };
    }

    // 4. Create the ACTIVE SOS alert
    const newAlert = await tx.sOSAlert.create({
      data: {
        userId,
        rideId: input.rideId ?? null,
        message: input.message ? input.message.trim() : null,
        latitude:
          input.latitude !== undefined && input.latitude !== null
            ? input.latitude
            : null,
        longitude:
          input.longitude !== undefined && input.longitude !== null
            ? input.longitude
            : null,
        status: SOSAlertStatus.ACTIVE,
      },
      select: sosAlertSelectProjection,
    });

    // 5. Fetch user's registered emergency contacts for immediate dispatch context
    const contacts = await tx.emergencyContact.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: emergencyContactSelectProjection,
    });

    return {
      alert: formatSOSAlert(newAlert),
      contacts,
      ride: rideSummary,
    };
  });

  // 6. Trigger emergency notification workflow to all saved emergency contacts
  let notifications: SOSNotificationOutput[] = [];
  try {
    notifications = await emergencyNotificationService.dispatchSOSNotifications(
      created.alert.alertId
    );
  } catch (error) {
    // Isolate notification dispatch errors: SOS alert creation is already committed
    // and must never cause the SOS activation API call to report failure or roll back.
    console.error(
      `[SOS] Emergency notification dispatch failed for alert ${created.alert.alertId}:`,
      error
    );
  }

  return {
    ...created,
    notifications,
  };
}

/**
 * Retrieves the currently active SOS alert for the authenticated user, if any.
 */
export async function getActiveSOSAlert(
  userId: string
): Promise<SOSAlertDetailOutput | null> {
  const alert = await prisma.sOSAlert.findFirst({
    where: {
      userId,
      status: SOSAlertStatus.ACTIVE,
    },
    include: {
      ride: {
        select: {
          rideId: true,
          source: true,
          destination: true,
          status: true,
        },
      },
    },
  });

  if (!alert) {
    return null;
  }

  const [contacts, notifications] = await Promise.all([
    prisma.emergencyContact.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: emergencyContactSelectProjection,
    }),
    prisma.sOSNotification.findMany({
      where: { alertId: alert.alertId },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return {
    alert: formatSOSAlert(alert),
    contacts,
    notifications,
    ride: alert.ride
      ? {
          rideId: alert.ride.rideId,
          source: alert.ride.source,
          destination: alert.ride.destination,
          status: alert.ride.status,
        }
      : null,
  };
}

/**
 * Retrieves a single SOS alert by ID with authorization checks.
 *
 * Rules:
 * 1. Alert must exist (404 Not Found).
 * 2. Requester must be the alert owner or have the platform ADMIN role (403 Forbidden).
 */
export async function getSOSAlertById(
  userId: string,
  alertId: string,
  isAdmin = false
): Promise<SOSAlertDetailOutput> {
  const alert = await prisma.sOSAlert.findUnique({
    where: { alertId },
    include: {
      ride: {
        select: {
          rideId: true,
          source: true,
          destination: true,
          status: true,
        },
      },
    },
  });

  if (!alert) {
    throw new NotFoundError('SOS alert not found');
  }

  if (alert.userId !== userId && !isAdmin) {
    throw new ForbiddenError(
      'Access denied: You do not have permission to view this SOS alert'
    );
  }

  const [contacts, notifications] = await Promise.all([
    prisma.emergencyContact.findMany({
      where: { userId: alert.userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: emergencyContactSelectProjection,
    }),
    prisma.sOSNotification.findMany({
      where: { alertId },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return {
    alert: formatSOSAlert(alert),
    contacts,
    notifications,
    ride: alert.ride
      ? {
          rideId: alert.ride.rideId,
          source: alert.ride.source,
          destination: alert.ride.destination,
          status: alert.ride.status,
        }
      : null,
  };
}

/**
 * Lists emergency alerts for the authenticated user with pagination and optional status filter.
 */
export async function listUserSOSAlerts(
  userId: string,
  query: ListSOSAlertsQueryInput
): Promise<{ alerts: SOSAlertOutput[]; pagination: PaginationMeta }> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: { userId: string; status?: SOSAlertStatus } = {
    userId,
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, alerts] = await Promise.all([
    prisma.sOSAlert.count({ where }),
    prisma.sOSAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: sosAlertSelectProjection,
    }),
  ]);

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    alerts: alerts.map(formatSOSAlert),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Resolves an active SOS alert.
 *
 * Rules:
 * 1. Alert must exist (404 Not Found).
 * 2. Requester must be the alert owner or platform ADMIN (403 Forbidden).
 * 3. Alert must currently have status `ACTIVE` (400 Bad Request otherwise).
 * 4. Sets status to `RESOLVED` and records `resolvedAt`.
 */
export async function resolveSOSAlert(
  userId: string,
  alertId: string,
  isAdmin = false,
  _notes?: string | null
): Promise<SOSAlertOutput> {
  return await prisma.$transaction(async (tx) => {
    const alert = await tx.sOSAlert.findUnique({
      where: { alertId },
      select: sosAlertSelectProjection,
    });

    if (!alert) {
      throw new NotFoundError('SOS alert not found');
    }

    if (alert.userId !== userId && !isAdmin) {
      throw new ForbiddenError(
        'Access denied: You do not have permission to resolve this SOS alert'
      );
    }

    if (alert.status !== SOSAlertStatus.ACTIVE) {
      throw new BadRequestError(
        `Cannot resolve an SOS alert with status ${alert.status}. Only ACTIVE alerts can be resolved.`
      );
    }

    // Atomic conditional update guarantees concurrent requests cannot overwrite state
    const updateResult = await tx.sOSAlert.updateMany({
      where: {
        alertId,
        status: SOSAlertStatus.ACTIVE,
      },
      data: {
        status: SOSAlertStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestError(
        'Cannot resolve an SOS alert that is no longer active'
      );
    }

    const updated = await tx.sOSAlert.findUnique({
      where: { alertId },
      select: sosAlertSelectProjection,
    });

    return formatSOSAlert(updated!);
  });
}

/**
 * Cancels an active SOS alert (e.g. false alarm).
 *
 * Rules:
 * 1. Alert must exist (404 Not Found).
 * 2. Requester must be the alert owner or platform ADMIN (403 Forbidden).
 * 3. Alert must currently have status `ACTIVE` (400 Bad Request otherwise).
 * 4. Sets status to `CANCELLED` and records `resolvedAt`.
 */
export async function cancelSOSAlert(
  userId: string,
  alertId: string,
  isAdmin = false
): Promise<SOSAlertOutput> {
  return await prisma.$transaction(async (tx) => {
    const alert = await tx.sOSAlert.findUnique({
      where: { alertId },
      select: sosAlertSelectProjection,
    });

    if (!alert) {
      throw new NotFoundError('SOS alert not found');
    }

    if (alert.userId !== userId && !isAdmin) {
      throw new ForbiddenError(
        'Access denied: You do not have permission to cancel this SOS alert'
      );
    }

    if (alert.status !== SOSAlertStatus.ACTIVE) {
      throw new BadRequestError(
        `Cannot cancel an SOS alert with status ${alert.status}. Only ACTIVE alerts can be cancelled.`
      );
    }

    // Atomic conditional update guarantees concurrent requests cannot overwrite state
    const updateResult = await tx.sOSAlert.updateMany({
      where: {
        alertId,
        status: SOSAlertStatus.ACTIVE,
      },
      data: {
        status: SOSAlertStatus.CANCELLED,
        resolvedAt: new Date(),
      },
    });

    if (updateResult.count === 0) {
      throw new BadRequestError(
        'Cannot cancel an SOS alert that is no longer active'
      );
    }

    const updated = await tx.sOSAlert.findUnique({
      where: { alertId },
      select: sosAlertSelectProjection,
    });

    return formatSOSAlert(updated!);
  });
}

export const sosService = {
  createSOSAlert,
  getActiveSOSAlert,
  getSOSAlertById,
  listUserSOSAlerts,
  resolveSOSAlert,
  cancelSOSAlert,
};
