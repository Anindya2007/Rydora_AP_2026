import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import {
  NotificationStatus,
  SOSAlertStatus,
} from '../generated/prisma/client.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../utils/errors.js';
import {
  defaultNotificationProvider,
  type EmergencyNotificationProvider,
  type EmergencyNotificationResult,
} from './notification-provider.js';

/**
 * Maximum duration allowed for an external notification provider call before timing out.
 * Strictly bounded to prevent provider calls from hanging or outliving claim leases.
 */
export const PROVIDER_TIMEOUT_MS = 10_000;

/**
 * Claim Time-To-Live in milliseconds.
 * Strictly bounded to be 3x greater than PROVIDER_TIMEOUT_MS so that a claim lease
 * CANNOT expire while its legitimate owner is still processing.
 *
 * Expired claims from crashed processes can be safely recovered after 30 seconds.
 */
export const CLAIM_TTL_MS = 30_000;

export interface SOSNotificationOutput {
  notificationId: string;
  alertId: string;
  contactId: string | null;
  recipientPhone: string;
  recipientName: string;
  channel: string;
  status: NotificationStatus;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
}

export const sosNotificationSelectProjection = {
  notificationId: true,
  alertId: true,
  contactId: true,
  recipientPhone: true,
  recipientName: true,
  channel: true,
  status: true,
  errorMessage: true,
  sentAt: true,
  createdAt: true,
};

/**
 * Format raw database SOSNotification row into clean DTO.
 */
export function formatSOSNotification(raw: {
  notificationId: string;
  alertId: string;
  contactId: string | null;
  recipientPhone: string;
  recipientName: string;
  channel: string;
  status: NotificationStatus;
  errorMessage: string | null;
  sentAt: Date | null;
  createdAt: Date;
}): SOSNotificationOutput {
  return {
    notificationId: raw.notificationId,
    alertId: raw.alertId,
    contactId: raw.contactId,
    recipientPhone: raw.recipientPhone,
    recipientName: raw.recipientName,
    channel: raw.channel,
    status: raw.status,
    errorMessage: raw.errorMessage,
    sentAt: raw.sentAt,
    createdAt: raw.createdAt,
  };
}

/**
 * Renews an active claim lease for a notification in database time.
 * Verifies claim ownership before extending the lease.
 * Returns the new claim token if renewal succeeded, or null if claim was lost.
 */
export async function renewClaimLease(
  notificationId: string,
  currentClaimToken: string
): Promise<string | null> {
  const parts = currentClaimToken.split(':');
  const workerId = parts[1] || crypto.randomUUID();

  const renewed = await prisma.$queryRaw<Array<{ error_message: string }>>`
    UPDATE "sos_notifications"
    SET "error_message" = 'CLAIM:' || ${workerId} || ':' || (EXTRACT(EPOCH FROM (clock_timestamp() + (${CLAIM_TTL_MS} || ' milliseconds')::interval)) * 1000)::bigint
    WHERE "notification_id" = ${notificationId}::uuid
      AND "error_message" = ${currentClaimToken}
    RETURNING "error_message"
  `;

  return renewed.length > 0 ? renewed[0].error_message : null;
}

/**
 * Dispatches emergency notifications to all registered emergency contacts for an SOS alert.
 *
 * Reliability, Concurrency & Claim Safety Invariants:
 * 1. Claim Lease Safety & Bounded Timeout:
 *    - Provider execution is bounded by PROVIDER_TIMEOUT_MS (10s).
 *    - Claim lease is CLAIM_TTL_MS (30s) in DATABASE time (PostgreSQL clock_timestamp()).
 *    - Because PROVIDER_TIMEOUT_MS < CLAIM_TTL_MS, a claim cannot expire while its legitimate
 *      owner is awaiting provider response.
 *    - Database time eliminates application-server clock skew across multi-node clusters.
 * 2. SQL Safety & Malformed Token Tolerance:
 *    - Uses safe regex matching (^CLAIM:[0-9a-fA-F-]+:[0-9]+$) before casting timestamp substrings.
 *    - Corrupted or malformed tokens are treated as invalid and safely reclaimed without SQL cast errors (22P02).
 * 3. Strict Claim Ownership on Every Mutation:
 *    - Every final SENT, FAILED, and PROVIDER_CONFIRMED update is conditional on:
 *      WHERE "notification_id" = ... AND "error_message" = ${assignedClaimToken}
 *    - A worker that lost its claim lease cannot overwrite a newer worker's state.
 * 4. Reconciliation Safety & Exactly-Once Semantics:
 *    - Reconciles PROVIDER_CONFIRMED records to SENT without re-dispatching duplicate messages.
 *    - Queries provider idempotency status for UNCERTAIN_DELIVERY records before retrying.
 *    - Upstream idempotency keys (${alertId}:${contact.phone}) prevent carrier duplicate API dispatches.
 */
export async function dispatchSOSNotifications(
  alertId: string,
  provider: EmergencyNotificationProvider = defaultNotificationProvider
): Promise<SOSNotificationOutput[]> {
  const alert = await prisma.sOSAlert.findUnique({
    where: { alertId },
    include: {
      user: {
        select: {
          userId: true,
          name: true,
          phone: true,
        },
      },
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

  // Fetch the user's emergency contacts, prioritizing primary contact
  const contacts = await prisma.emergencyContact.findMany({
    where: { userId: alert.userId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });

  if (contacts.length === 0) {
    return [];
  }

  const mapsUrl =
    alert.latitude && alert.longitude
      ? `https://maps.google.com/?q=${alert.latitude},${alert.longitude}`
      : null;

  const rideSummary = alert.ride
    ? `${alert.ride.source} -> ${alert.ride.destination}`
    : null;

  const results: SOSNotificationOutput[] = [];

  for (const contact of contacts) {
    const idempotencyKey = `${alertId}:${contact.phone}`;

    // 1. Check for duplicate processing per (alertId, recipientPhone)
    const existing = await prisma.sOSNotification.findUnique({
      where: {
        alertId_recipientPhone: {
          alertId,
          recipientPhone: contact.phone,
        },
      },
      select: sosNotificationSelectProjection,
    });

    if (existing && existing.status === NotificationStatus.SENT) {
      // Already successfully sent, skip to prevent duplicate messaging
      results.push(formatSOSNotification(existing));
      continue;
    }

    // 2. Reconciliation check: If provider already confirmed in a previous run but DB update glitched
    if (existing?.errorMessage && existing.errorMessage.startsWith('PROVIDER_CONFIRMED:')) {
      try {
        const reconciled = await prisma.sOSNotification.update({
          where: { notificationId: existing.notificationId },
          data: {
            status: NotificationStatus.SENT,
            sentAt: existing.sentAt || new Date(),
            errorMessage: null,
          },
          select: sosNotificationSelectProjection,
        });
        results.push(formatSOSNotification(reconciled));
        continue;
      } catch {
        // If DB update fails, return existing without re-dispatching duplicate
        results.push(formatSOSNotification(existing));
        continue;
      }
    }

    // 3. Uncertain delivery check: Provider previously encountered network timeout
    // If the provider adapter can confirm delivery status via idempotency key, reconcile without resending.
    if (existing?.errorMessage && existing.errorMessage.startsWith('UNCERTAIN_DELIVERY:')) {
      if (typeof provider.getProcessedNotification === 'function') {
        const priorDelivery = await provider.getProcessedNotification(idempotencyKey);
        if (priorDelivery?.success) {
          try {
            const reconciled = await prisma.sOSNotification.update({
              where: { notificationId: existing.notificationId },
              data: {
                status: NotificationStatus.SENT,
                sentAt: existing.sentAt || new Date(),
                errorMessage: null,
              },
              select: sosNotificationSelectProjection,
            });
            results.push(formatSOSNotification(reconciled));
            continue;
          } catch {
            results.push(formatSOSNotification(existing));
            continue;
          }
        }
      }
    }

    // 4. Ensure notification record exists in PENDING state
    const record = await prisma.sOSNotification.upsert({
      where: {
        alertId_recipientPhone: {
          alertId,
          recipientPhone: contact.phone,
        },
      },
      create: {
        alertId,
        contactId: contact.contactId,
        recipientPhone: contact.phone,
        recipientName: contact.name,
        channel: 'SMS',
        status: NotificationStatus.PENDING,
      },
      update: {},
      select: sosNotificationSelectProjection,
    });

    // 5. Atomic conditional claim in DATABASE time with safe regex parsing
    const workerUuid = crypto.randomUUID();
    const claimedRows = await prisma.$queryRaw<Array<{ notification_id: string; error_message: string | null }>>`
      UPDATE "sos_notifications"
      SET "error_message" = 'CLAIM:' || ${workerUuid} || ':' || (EXTRACT(EPOCH FROM (clock_timestamp() + (${CLAIM_TTL_MS} || ' milliseconds')::interval)) * 1000)::bigint
      WHERE "notification_id" = ${record.notificationId}::uuid
        AND "status" != 'SENT'
        AND (
          "error_message" IS NULL
          OR (
            "error_message" NOT LIKE 'CLAIM:%'
            AND "error_message" NOT LIKE 'PROVIDER_CONFIRMED:%'
          )
          OR (
            "error_message" LIKE 'CLAIM:%'
            AND (
              "error_message" !~ '^CLAIM:[0-9a-fA-F-]+:[0-9]+$'
              OR (substring("error_message" from '^CLAIM:[0-9a-fA-F-]+:([0-9]+)$'))::numeric < (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)
            )
          )
        )
      RETURNING "notification_id", "error_message"
    `;

    if (claimedRows.length === 0) {
      // Another concurrent worker/request has an active, unexpired claim or record already resolved
      const current = await prisma.sOSNotification.findUnique({
        where: { notificationId: record.notificationId },
        select: sosNotificationSelectProjection,
      });
      if (current) {
        results.push(formatSOSNotification(current));
      }
      continue;
    }

    const assignedClaimToken = claimedRows[0].error_message!;

    // 6. Dispatch via notification provider (OUTSIDE database transactions, bounded by PROVIDER_TIMEOUT_MS)
    let deliveryResult: EmergencyNotificationResult;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Provider call timed out after ${PROVIDER_TIMEOUT_MS}ms`));
        }, PROVIDER_TIMEOUT_MS);
        timer.unref?.();
      });

      deliveryResult = await Promise.race([
        provider.sendEmergencyNotification({
          alertId,
          userName: alert.user.name,
          recipientPhone: contact.phone,
          recipientName: contact.name,
          message: alert.message,
          latitude: alert.latitude ? alert.latitude.toString() : null,
          longitude: alert.longitude ? alert.longitude.toString() : null,
          mapsUrl,
          rideSummary,
          timestamp: alert.createdAt,
          idempotencyKey,
        }),
        timeoutPromise,
      ]);
    } catch (providerError: any) {
      // Provider-level failure (network timeout / carrier socket exception)
      // External delivery outcome is uncertain.
      const errorMsg = `UNCERTAIN_DELIVERY: Provider dispatch failed: ${providerError?.message || 'Network timeout'}`;

      // Conditional update enforcing claim ownership:
      const updatedRows = await prisma.$queryRaw<Array<{ notification_id: string }>>`
        UPDATE "sos_notifications"
        SET "status" = 'FAILED',
            "error_message" = ${errorMsg},
            "sent_at" = NULL
        WHERE "notification_id" = ${record.notificationId}::uuid
          AND "error_message" = ${assignedClaimToken}
        RETURNING "notification_id"
      `;

      if (updatedRows.length === 0) {
        console.warn(`[SOS-Notifications] Worker lost claim lease for notification ${record.notificationId}`);
      }

      const current = await prisma.sOSNotification.findUnique({
        where: { notificationId: record.notificationId },
        select: sosNotificationSelectProjection,
      });
      if (current) {
        results.push(formatSOSNotification(current));
      }
      continue;
    }

    if (!deliveryResult.success) {
      // Carrier / Provider rejection (Outcome is certain: carrier rejected payload)
      const errorMsg = `Carrier delivery rejected: ${deliveryResult.error || 'Carrier failure'}`;

      // Conditional update enforcing claim ownership:
      const updatedRows = await prisma.$queryRaw<Array<{ notification_id: string }>>`
        UPDATE "sos_notifications"
        SET "status" = 'FAILED',
            "error_message" = ${errorMsg},
            "sent_at" = NULL
        WHERE "notification_id" = ${record.notificationId}::uuid
          AND "error_message" = ${assignedClaimToken}
        RETURNING "notification_id"
      `;

      if (updatedRows.length === 0) {
        console.warn(`[SOS-Notifications] Worker lost claim lease for notification ${record.notificationId}`);
      }

      const current = await prisma.sOSNotification.findUnique({
        where: { notificationId: record.notificationId },
        select: sosNotificationSelectProjection,
      });
      if (current) {
        results.push(formatSOSNotification(current));
      }
      continue;
    }

    // 7. Provider succeeded! Update to SENT conditional on claim ownership
    try {
      const sentRows = await prisma.$queryRaw<Array<{ notification_id: string }>>`
        UPDATE "sos_notifications"
        SET "status" = 'SENT',
            "sent_at" = clock_timestamp(),
            "error_message" = NULL
        WHERE "notification_id" = ${record.notificationId}::uuid
          AND "error_message" = ${assignedClaimToken}
        RETURNING "notification_id"
      `;

      if (sentRows.length === 0) {
        console.warn(`[SOS-Notifications] Worker lost claim lease before updating SENT for ${record.notificationId}`);
      }

      const current = await prisma.sOSNotification.findUnique({
        where: { notificationId: record.notificationId },
        select: sosNotificationSelectProjection,
      });

      if (current) {
        results.push(formatSOSNotification(current));
      } else {
        results.push(
          formatSOSNotification({
            ...record,
            status: NotificationStatus.SENT,
            sentAt: new Date(),
            errorMessage: null,
          })
        );
      }
    } catch (persistenceError: any) {
      // Provider confirmed delivery, but updating SENT encountered a DB error.
      // Do NOT mark as FAILED! Set conditional PROVIDER_CONFIRMED reconciliation marker.
      const confirmedMarker = `PROVIDER_CONFIRMED:${deliveryResult.messageId || 'ok'}:${new Date().toISOString()}`;
      try {
        await prisma.$queryRaw`
          UPDATE "sos_notifications"
          SET "error_message" = ${confirmedMarker}
          WHERE "notification_id" = ${record.notificationId}::uuid
            AND "error_message" = ${assignedClaimToken}
        `;
      } catch {
        console.error(
          `[SOS-Notifications] CRITICAL: Both SENT update and PROVIDER_CONFIRMED marker update failed for notification ${record.notificationId}. Provider messageId=${deliveryResult.messageId}. External idempotency key=${idempotencyKey} will protect against duplicate delivery.`
        );
      }

      const current = await prisma.sOSNotification.findUnique({
        where: { notificationId: record.notificationId },
        select: sosNotificationSelectProjection,
      }).catch(() => null);

      results.push(
        formatSOSNotification(
          current || {
            ...record,
            status: NotificationStatus.PENDING,
            errorMessage: confirmedMarker,
          }
        )
      );
    }
  }

  return results;
}

/**
 * Retrieves all notification logs for an SOS alert with authorization checks.
 */
export async function getAlertNotifications(
  userId: string,
  alertId: string,
  isAdmin = false
): Promise<SOSNotificationOutput[]> {
  const alert = await prisma.sOSAlert.findUnique({
    where: { alertId },
    select: { userId: true },
  });

  if (!alert) {
    throw new NotFoundError('SOS alert not found');
  }

  if (alert.userId !== userId && !isAdmin) {
    throw new ForbiddenError(
      'Access denied: You do not have permission to view notifications for this SOS alert'
    );
  }

  const notifications = await prisma.sOSNotification.findMany({
    where: { alertId },
    orderBy: { createdAt: 'asc' },
    select: sosNotificationSelectProjection,
  });

  return notifications.map(formatSOSNotification);
}

/**
 * Retries failed emergency notifications for an active SOS alert.
 */
export async function retryFailedNotifications(
  userId: string,
  alertId: string,
  isAdmin = false,
  provider: EmergencyNotificationProvider = defaultNotificationProvider
): Promise<SOSNotificationOutput[]> {
  const alert = await prisma.sOSAlert.findUnique({
    where: { alertId },
    select: { userId: true, status: true },
  });

  if (!alert) {
    throw new NotFoundError('SOS alert not found');
  }

  if (alert.userId !== userId && !isAdmin) {
    throw new ForbiddenError(
      'Access denied: You do not have permission to retry notifications for this SOS alert'
    );
  }

  if (alert.status !== SOSAlertStatus.ACTIVE) {
    throw new BadRequestError(
      `Cannot retry notifications for an SOS alert with status ${alert.status}. Only ACTIVE alerts can be escalated.`
    );
  }

  return await dispatchSOSNotifications(alertId, provider);
}

export const emergencyNotificationService = {
  dispatchSOSNotifications,
  getAlertNotifications,
  retryFailedNotifications,
  renewClaimLease,
};
