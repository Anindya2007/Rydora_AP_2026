import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { prisma } from '../../src/config/prisma.js';
import { env } from '../../src/config/env.js';
import {
  UserRole,
  SOSAlertStatus,
  NotificationStatus,
  RideStatus,
} from '../../src/generated/prisma/client.js';
import {
  emergencyNotificationService,
  renewClaimLease,
} from '../../src/services/emergency-notification.service.js';
import {
  SimulatedEmergencyNotificationProvider,
  type EmergencyNotificationProvider,
  type EmergencyNotificationPayload,
} from '../../src/services/notification-provider.js';

describe('Milestone 8.3: Emergency Notifications & SOS Escalation', () => {
  const mockUserId = '11111111-2222-3333-4444-555555555555';
  const mockOtherUserId = '22222222-3333-4444-5555-666666666666';
  const mockAdminUserId = '99999999-9999-9999-9999-999999999999';
  const mockAlertId = '33333333-4444-5555-6666-777777777777';
  const mockRideId = '44444444-5555-6666-7777-888888888888';

  const mockTimestamp = new Date('2026-11-23T10:00:00.000Z');

  const mockDbUser = {
    userId: mockUserId,
    name: 'Aarav Patel',
    email: 'aarav@rydora.in',
    phone: '+919876543210',
    roles: [UserRole.USER],
    profileImage: null,
    licenseNumber: null,
    licenseExpiry: null,
    driverVerified: false,
    walletBalance: '500.00',
    averageRating: '4.80',
    ratingCount: 5,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockOtherDbUser = {
    userId: mockOtherUserId,
    name: 'Sneha Rao',
    email: 'sneha@rydora.in',
    phone: '+919876543222',
    roles: [UserRole.USER],
    profileImage: null,
    licenseNumber: null,
    licenseExpiry: null,
    driverVerified: false,
    walletBalance: '0.00',
    averageRating: '5.00',
    ratingCount: 0,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockAdminDbUser = {
    userId: mockAdminUserId,
    name: 'Admin User',
    email: 'admin@rydora.in',
    phone: '+919876500000',
    roles: ['ADMIN'],
    profileImage: null,
    licenseNumber: null,
    licenseExpiry: null,
    driverVerified: true,
    walletBalance: '1000.00',
    averageRating: '5.00',
    ratingCount: 10,
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  const mockEmergencyContacts = [
    {
      contactId: '55555555-5555-5555-5555-555555555555',
      userId: mockUserId,
      name: 'Rajesh Patel',
      phone: '+919876500001',
      relationship: 'Father',
      isPrimary: true,
      createdAt: mockTimestamp,
    },
    {
      contactId: '66666666-6666-6666-6666-666666666666',
      userId: mockUserId,
      name: 'Sunita Patel',
      phone: '+919876500002',
      relationship: 'Mother',
      isPrimary: false,
      createdAt: mockTimestamp,
    },
  ];

  const mockSOSAlert = {
    alertId: mockAlertId,
    userId: mockUserId,
    rideId: mockRideId,
    message: 'Medical emergency on highway',
    latitude: '28.613900',
    longitude: '77.209000',
    status: SOSAlertStatus.ACTIVE,
    createdAt: mockTimestamp,
    resolvedAt: null,
    user: mockDbUser,
    ride: {
      rideId: mockRideId,
      source: 'Connaught Place',
      destination: 'Noida Sector 62',
      status: RideStatus.SCHEDULED,
    },
  };

  const generateToken = (userId: string): string => {
    return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '24h' });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(prisma, '$executeRaw').mockResolvedValue(1 as any);
    vi.spyOn(prisma, '$queryRaw').mockImplementation(async (strings: any, ...values: any[]) => {
      // Default: successfully return claimed/updated row
      return [{ notification_id: 'mock-notif-id', error_message: 'CLAIM:mock-worker:9999999999999' }];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. EMERGENCY NOTIFICATION DISPATCH SERVICE UNIT TESTS
  // =========================================================================
  describe('emergencyNotificationService.dispatchSOSNotifications', () => {
    it('should dispatch notifications to all user emergency contacts and record SENT status', async () => {
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue(mockEmergencyContacts as any);

      let findUniqueCallCount = 0;
      vi.spyOn(prisma.sOSNotification, 'findUnique').mockImplementation(async (args: any) => {
        findUniqueCallCount++;
        // Initial checks return null; subsequent post-update queries return SENT
        if (findUniqueCallCount % 2 === 1) {
          return null;
        }
        return {
          notificationId: 'notif-id-1',
          alertId: mockAlertId,
          contactId: 'mock-contact-id',
          recipientPhone: '+919876500001',
          recipientName: 'Rajesh Patel',
          channel: 'SMS',
          status: NotificationStatus.SENT,
          errorMessage: null,
          sentAt: mockTimestamp,
          createdAt: mockTimestamp,
        } as any;
      });

      const upsertSpy = vi.spyOn(prisma.sOSNotification, 'upsert').mockImplementation((args: any) =>
        Promise.resolve({
          notificationId: `notif-${args.create.recipientPhone}`,
          alertId: mockAlertId,
          contactId: args.create.contactId,
          recipientPhone: args.create.recipientPhone,
          recipientName: args.create.recipientName,
          channel: 'SMS',
          status: NotificationStatus.PENDING,
          errorMessage: null,
          sentAt: null,
          createdAt: mockTimestamp,
        } as any)
      );

      const mockProvider: EmergencyNotificationProvider = {
        sendEmergencyNotification: vi.fn().mockResolvedValue({
          success: true,
          messageId: 'mock-msg-123',
        }),
      };

      const results = await emergencyNotificationService.dispatchSOSNotifications(
        mockAlertId,
        mockProvider
      );

      expect(results).toHaveLength(2);
      expect(mockProvider.sendEmergencyNotification).toHaveBeenCalledTimes(2);

      // Verify payload passed to provider includes complete SOS context and idempotencyKey
      const firstCallPayload = (mockProvider.sendEmergencyNotification as any).mock.calls[0][0] as EmergencyNotificationPayload;
      expect(firstCallPayload.alertId).toBe(mockAlertId);
      expect(firstCallPayload.userName).toBe('Aarav Patel');
      expect(firstCallPayload.recipientPhone).toBe('+919876500001');
      expect(firstCallPayload.message).toBe('Medical emergency on highway');
      expect(firstCallPayload.mapsUrl).toContain('maps.google.com');
      expect(firstCallPayload.rideSummary).toContain('Connaught Place -> Noida Sector 62');
      expect(firstCallPayload.idempotencyKey).toBe(`${mockAlertId}:+919876500001`);

      expect(upsertSpy).toHaveBeenCalledTimes(2);
    });

    it('should prevent duplicate processing if notification was already SENT to recipient', async () => {
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([mockEmergencyContacts[0]] as any);

      // Notification was already sent previously
      vi.spyOn(prisma.sOSNotification, 'findUnique').mockResolvedValue({
        notificationId: 'notif-already-sent',
        alertId: mockAlertId,
        contactId: mockEmergencyContacts[0].contactId,
        recipientPhone: mockEmergencyContacts[0].phone,
        recipientName: mockEmergencyContacts[0].name,
        channel: 'SMS',
        status: NotificationStatus.SENT,
        errorMessage: null,
        sentAt: mockTimestamp,
        createdAt: mockTimestamp,
      } as any);

      const mockProvider: EmergencyNotificationProvider = {
        sendEmergencyNotification: vi.fn(),
      };

      const results = await emergencyNotificationService.dispatchSOSNotifications(
        mockAlertId,
        mockProvider
      );

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe(NotificationStatus.SENT);
      // Provider must NOT be called again
      expect(mockProvider.sendEmergencyNotification).not.toHaveBeenCalled();
    });

    it('should prevent concurrent duplicate dispatch when atomic claim returns 0 (already claimed by another worker)', async () => {
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([mockEmergencyContacts[0]] as any);
      vi.spyOn(prisma.sOSNotification, 'findUnique')
        .mockResolvedValueOnce(null) // initial check
        .mockResolvedValueOnce({
          // fallback fetch after claim returned 0
          notificationId: 'notif-concurrent-id',
          alertId: mockAlertId,
          contactId: mockEmergencyContacts[0].contactId,
          recipientPhone: mockEmergencyContacts[0].phone,
          recipientName: mockEmergencyContacts[0].name,
          channel: 'SMS',
          status: NotificationStatus.PENDING,
          errorMessage: 'CLAIM:other-worker-uuid:9999999999999',
          sentAt: null,
          createdAt: mockTimestamp,
        } as any);

      vi.spyOn(prisma.sOSNotification, 'upsert').mockResolvedValue({
        notificationId: 'notif-concurrent-id',
        status: NotificationStatus.PENDING,
      } as any);

      // Simulate atomic claim returning 0 rows (another concurrent worker owns the active unexpired claim)
      vi.spyOn(prisma, '$queryRaw').mockResolvedValue([] as any);

      const mockProvider: EmergencyNotificationProvider = {
        sendEmergencyNotification: vi.fn(),
      };

      const results = await emergencyNotificationService.dispatchSOSNotifications(
        mockAlertId,
        mockProvider
      );

      expect(results).toHaveLength(1);
      // Provider must NOT be invoked because another worker claimed the task
      expect(mockProvider.sendEmergencyNotification).not.toHaveBeenCalled();
    });

    it('should enforce claim ownership on SENT update and warn if worker lost lease', async () => {
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([mockEmergencyContacts[0]] as any);
      vi.spyOn(prisma.sOSNotification, 'upsert').mockResolvedValue({
        notificationId: 'notif-claim-lost-id',
        status: NotificationStatus.PENDING,
      } as any);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Claim succeeds (1 row claimed)
      // SENT update returns [] (0 rows updated because another worker replaced claim)
      let queryRawCount = 0;
      vi.spyOn(prisma, '$queryRaw').mockImplementation(async () => {
        queryRawCount++;
        if (queryRawCount === 1) {
          return [{ notification_id: 'notif-claim-lost-id', error_message: 'CLAIM:worker-1:9999999999999' }];
        }
        return []; // 0 rows updated for SENT!
      });

      vi.spyOn(prisma.sOSNotification, 'findUnique')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          notificationId: 'notif-claim-lost-id',
          alertId: mockAlertId,
          contactId: mockEmergencyContacts[0].contactId,
          recipientPhone: mockEmergencyContacts[0].phone,
          recipientName: mockEmergencyContacts[0].name,
          channel: 'SMS',
          status: NotificationStatus.PENDING,
          errorMessage: 'CLAIM:worker-2:9999999999999',
          sentAt: null,
          createdAt: mockTimestamp,
        } as any);

      const mockProvider: EmergencyNotificationProvider = {
        sendEmergencyNotification: vi.fn().mockResolvedValue({
          success: true,
          messageId: 'sim_msg_slow',
        }),
      };

      const results = await emergencyNotificationService.dispatchSOSNotifications(
        mockAlertId,
        mockProvider
      );

      expect(results).toHaveLength(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Worker lost claim lease before updating SENT')
      );
    });

    it('should catch provider exception, mark notification FAILED with UNCERTAIN_DELIVERY, and continue processing', async () => {
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([mockEmergencyContacts[0]] as any);
      vi.spyOn(prisma.sOSNotification, 'upsert').mockResolvedValue({
        notificationId: 'notif-ex-id',
        status: NotificationStatus.PENDING,
      } as any);

      vi.spyOn(prisma.sOSNotification, 'findUnique')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          notificationId: 'notif-ex-id',
          alertId: mockAlertId,
          contactId: mockEmergencyContacts[0].contactId,
          recipientPhone: mockEmergencyContacts[0].phone,
          recipientName: mockEmergencyContacts[0].name,
          channel: 'SMS',
          status: NotificationStatus.FAILED,
          errorMessage: 'UNCERTAIN_DELIVERY: Provider dispatch failed: Connection reset by peer',
          sentAt: null,
          createdAt: mockTimestamp,
        } as any);

      const mockThrowingProvider: EmergencyNotificationProvider = {
        sendEmergencyNotification: vi.fn().mockRejectedValue(new Error('Connection reset by peer')),
      };

      const results = await emergencyNotificationService.dispatchSOSNotifications(
        mockAlertId,
        mockThrowingProvider
      );

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe(NotificationStatus.FAILED);
      expect(results[0].errorMessage).toContain('UNCERTAIN_DELIVERY: Provider dispatch failed');
      expect(results[0].errorMessage).toContain('Connection reset by peer');
    });

    it('should tag PROVIDER_CONFIRMED reconciliation state when provider succeeds but persisting SENT status fails', async () => {
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([mockEmergencyContacts[0]] as any);
      vi.spyOn(prisma.sOSNotification, 'upsert').mockResolvedValue({
        notificationId: 'notif-persist-fail-id',
        status: NotificationStatus.PENDING,
      } as any);

      // Claim succeeds.
      // Update to SENT throws DB error.
      // Update to PROVIDER_CONFIRMED succeeds.
      let queryRawCount = 0;
      vi.spyOn(prisma, '$queryRaw').mockImplementation(async () => {
        queryRawCount++;
        if (queryRawCount === 1) {
          return [{ notification_id: 'notif-persist-fail-id', error_message: 'CLAIM:w1:9999999999999' }];
        }
        if (queryRawCount === 2) {
          throw new Error('DB connection dropped during SENT commit');
        }
        return [{ notification_id: 'notif-persist-fail-id' }];
      });

      vi.spyOn(prisma.sOSNotification, 'findUnique')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          notificationId: 'notif-persist-fail-id',
          alertId: mockAlertId,
          contactId: mockEmergencyContacts[0].contactId,
          recipientPhone: mockEmergencyContacts[0].phone,
          recipientName: mockEmergencyContacts[0].name,
          channel: 'SMS',
          status: NotificationStatus.PENDING,
          errorMessage: 'PROVIDER_CONFIRMED:msg-ext-999:2026-11-23T10:00:00.000Z',
          sentAt: null,
          createdAt: mockTimestamp,
        } as any);

      const mockProvider: EmergencyNotificationProvider = {
        sendEmergencyNotification: vi.fn().mockResolvedValue({
          success: true,
          messageId: 'msg-ext-999',
        }),
      };

      const results = await emergencyNotificationService.dispatchSOSNotifications(
        mockAlertId,
        mockProvider
      );

      expect(results).toHaveLength(1);
      // Must NOT be marked as FAILED because the provider delivered it
      expect(results[0].status).not.toBe(NotificationStatus.FAILED);
      expect(results[0].errorMessage).toContain('PROVIDER_CONFIRMED:msg-ext-999');
    });

    it('should reconcile PROVIDER_CONFIRMED record to SENT on subsequent run without re-calling provider', async () => {
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([mockEmergencyContacts[0]] as any);

      // Existing record has PROVIDER_CONFIRMED tag
      vi.spyOn(prisma.sOSNotification, 'findUnique').mockResolvedValue({
        notificationId: 'notif-reconcile-id',
        alertId: mockAlertId,
        contactId: mockEmergencyContacts[0].contactId,
        recipientPhone: mockEmergencyContacts[0].phone,
        recipientName: mockEmergencyContacts[0].name,
        channel: 'SMS',
        status: NotificationStatus.PENDING,
        errorMessage: 'PROVIDER_CONFIRMED:msg-ext-999:2026-11-23T10:00:00.000Z',
        sentAt: null,
        createdAt: mockTimestamp,
      } as any);

      const updateSpy = vi.spyOn(prisma.sOSNotification, 'update').mockResolvedValue({
        notificationId: 'notif-reconcile-id',
        alertId: mockAlertId,
        contactId: mockEmergencyContacts[0].contactId,
        recipientPhone: mockEmergencyContacts[0].phone,
        recipientName: mockEmergencyContacts[0].name,
        channel: 'SMS',
        status: NotificationStatus.SENT,
        errorMessage: null,
        sentAt: mockTimestamp,
        createdAt: mockTimestamp,
      } as any);

      const mockProvider: EmergencyNotificationProvider = {
        sendEmergencyNotification: vi.fn(),
      };

      const results = await emergencyNotificationService.dispatchSOSNotifications(
        mockAlertId,
        mockProvider
      );

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe(NotificationStatus.SENT);
      // Provider must NOT be called because it already confirmed earlier
      expect(mockProvider.sendEmergencyNotification).not.toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: NotificationStatus.SENT,
            errorMessage: null,
          }),
        })
      );
    });

    it('should reconcile UNCERTAIN_DELIVERY record to SENT on retry when provider adapter confirms prior delivery', async () => {
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([mockEmergencyContacts[0]] as any);

      // Existing record has UNCERTAIN_DELIVERY marker
      vi.spyOn(prisma.sOSNotification, 'findUnique').mockResolvedValue({
        notificationId: 'notif-uncertain-id',
        alertId: mockAlertId,
        contactId: mockEmergencyContacts[0].contactId,
        recipientPhone: mockEmergencyContacts[0].phone,
        recipientName: mockEmergencyContacts[0].name,
        channel: 'SMS',
        status: NotificationStatus.FAILED,
        errorMessage: 'UNCERTAIN_DELIVERY: Provider exception (Network timeout)',
        sentAt: null,
        createdAt: mockTimestamp,
      } as any);

      const updateSpy = vi.spyOn(prisma.sOSNotification, 'update').mockResolvedValue({
        notificationId: 'notif-uncertain-id',
        alertId: mockAlertId,
        contactId: mockEmergencyContacts[0].contactId,
        recipientPhone: mockEmergencyContacts[0].phone,
        recipientName: mockEmergencyContacts[0].name,
        channel: 'SMS',
        status: NotificationStatus.SENT,
        errorMessage: null,
        sentAt: mockTimestamp,
        createdAt: mockTimestamp,
      } as any);

      const mockProviderWithQuery: EmergencyNotificationProvider = {
        sendEmergencyNotification: vi.fn(),
        getProcessedNotification: vi.fn().mockResolvedValue({
          success: true,
          messageId: 'sim_msg_confirmed_earlier',
        }),
      };

      const results = await emergencyNotificationService.dispatchSOSNotifications(
        mockAlertId,
        mockProviderWithQuery
      );

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe(NotificationStatus.SENT);
      // Provider send was NOT invoked again because query confirmed prior delivery!
      expect(mockProviderWithQuery.sendEmergencyNotification).not.toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: NotificationStatus.SENT,
            errorMessage: null,
          }),
        })
      );
    });

    it('should handle carrier delivery rejection cleanly and record FAILED status without marking as SENT', async () => {
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([mockEmergencyContacts[0]] as any);
      vi.spyOn(prisma.sOSNotification, 'upsert').mockResolvedValue({
        notificationId: 'notif-failed-id',
        status: NotificationStatus.PENDING,
      } as any);

      vi.spyOn(prisma.sOSNotification, 'findUnique')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          notificationId: 'notif-failed-id',
          alertId: mockAlertId,
          contactId: mockEmergencyContacts[0].contactId,
          recipientPhone: mockEmergencyContacts[0].phone,
          recipientName: mockEmergencyContacts[0].name,
          channel: 'SMS',
          status: NotificationStatus.FAILED,
          errorMessage: 'Carrier delivery rejected: Carrier network unreachable',
          sentAt: null,
          createdAt: mockTimestamp,
        } as any);

      const mockFailingProvider: EmergencyNotificationProvider = {
        sendEmergencyNotification: vi.fn().mockResolvedValue({
          success: false,
          error: 'Carrier network unreachable',
        }),
      };

      const results = await emergencyNotificationService.dispatchSOSNotifications(
        mockAlertId,
        mockFailingProvider
      );

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe(NotificationStatus.FAILED);
      expect(results[0].errorMessage).toContain('Carrier network unreachable');
      expect(results[0].sentAt).toBeNull();
    });

    it('should handle users with zero emergency contacts gracefully', async () => {
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(mockSOSAlert as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([]);

      const mockProvider: EmergencyNotificationProvider = {
        sendEmergencyNotification: vi.fn(),
      };

      const results = await emergencyNotificationService.dispatchSOSNotifications(
        mockAlertId,
        mockProvider
      );

      expect(results).toEqual([]);
      expect(mockProvider.sendEmergencyNotification).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. LEASE RENEWAL & PROVIDER IDEMPOTENCY UNIT TESTS
  // =========================================================================
  describe('Claim Lease Renewal and Provider Idempotency', () => {
    it('should renew claim lease successfully in database time when worker holds ownership', async () => {
      vi.spyOn(prisma, '$queryRaw').mockResolvedValue([
        { error_message: 'CLAIM:worker-1:9999999999999' },
      ] as any);

      const renewed = await renewClaimLease('notif-renew-id', 'CLAIM:worker-1:1111111111111');
      expect(renewed).toBe('CLAIM:worker-1:9999999999999');
    });

    it('should return null when renewing claim lease if worker lost ownership', async () => {
      vi.spyOn(prisma, '$queryRaw').mockResolvedValue([] as any);

      const renewed = await renewClaimLease('notif-renew-id', 'CLAIM:worker-1:1111111111111');
      expect(renewed).toBeNull();
    });

    it('should enforce provider-level idempotency in SimulatedEmergencyNotificationProvider', async () => {
      const provider = new SimulatedEmergencyNotificationProvider();
      const payload: EmergencyNotificationPayload = {
        alertId: mockAlertId,
        userName: 'Aarav Patel',
        recipientPhone: '+919876500001',
        recipientName: 'Rajesh Patel',
        message: 'SOS Help',
        latitude: null,
        longitude: null,
        mapsUrl: null,
        rideSummary: null,
        timestamp: new Date(),
        idempotencyKey: 'idemp-key-12345',
      };

      const firstResult = await provider.sendEmergencyNotification(payload);
      expect(firstResult.success).toBe(true);
      expect(firstResult.messageId).toBeDefined();
      expect(firstResult.duplicateSuppressed).toBeUndefined();

      // Second call with same idempotency key
      const secondResult = await provider.sendEmergencyNotification(payload);
      expect(secondResult.success).toBe(true);
      expect(secondResult.messageId).toBe(firstResult.messageId);
      expect(secondResult.duplicateSuppressed).toBe(true);

      // Verify query interface
      const queried = provider.getProcessedNotification('idemp-key-12345');
      expect(queried?.messageId).toBe(firstResult.messageId);
    });
  });

  // =========================================================================
  // 3. GET NOTIFICATION AUDIT LOGS (GET /api/v1/sos/:alertId/notifications)
  // =========================================================================
  describe('GET /api/v1/sos/:alertId/notifications', () => {
    it('should allow alert owner to retrieve notification delivery status (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        userId: mockUserId,
      } as any);
      vi.spyOn(prisma.sOSNotification, 'findMany').mockResolvedValue([
        {
          notificationId: 'notif-1',
          alertId: mockAlertId,
          contactId: mockEmergencyContacts[0].contactId,
          recipientPhone: mockEmergencyContacts[0].phone,
          recipientName: mockEmergencyContacts[0].name,
          channel: 'SMS',
          status: NotificationStatus.SENT,
          errorMessage: null,
          sentAt: mockTimestamp,
          createdAt: mockTimestamp,
        },
      ] as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get(`/api/v1/sos/${mockAlertId}/notifications`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data.notifications[0].status).toBe('SENT');
      expect(res.body.data.notifications[0].recipientPhone).toBe('+919876500001');
    });

    it('should allow platform ADMIN to view notification logs (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockAdminDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        userId: mockUserId, // Owned by another user
      } as any);
      vi.spyOn(prisma.sOSNotification, 'findMany').mockResolvedValue([]);

      const token = generateToken(mockAdminUserId);
      const res = await request(app)
        .get(`/api/v1/sos/${mockAlertId}/notifications`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toEqual([]);
    });

    it('should reject non-owner, non-admin from viewing notification logs with 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockOtherDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        userId: mockUserId, // Owned by mockUserId
      } as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .get(`/api/v1/sos/${mockAlertId}/notifications`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 Not Found if alert does not exist', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue(null);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get(`/api/v1/sos/${mockAlertId}/notifications`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 422 Unprocessable Entity for invalid alertId UUID', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .get('/api/v1/sos/invalid-uuid/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // 4. RETRY FAILED NOTIFICATIONS (POST /api/v1/sos/:alertId/notifications/retry)
  // =========================================================================
  describe('POST /api/v1/sos/:alertId/notifications/retry', () => {
    it('should allow owner to retry failed notifications for an ACTIVE alert (200 OK)', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        ...mockSOSAlert,
        status: SOSAlertStatus.ACTIVE,
      } as any);
      vi.spyOn(prisma.emergencyContact, 'findMany').mockResolvedValue([mockEmergencyContacts[0]] as any);
      vi.spyOn(prisma.sOSNotification, 'findUnique')
        .mockResolvedValueOnce({
          notificationId: 'notif-1',
          status: NotificationStatus.FAILED,
        } as any)
        .mockResolvedValueOnce({
          notificationId: 'notif-1',
          alertId: mockAlertId,
          contactId: mockEmergencyContacts[0].contactId,
          recipientPhone: mockEmergencyContacts[0].phone,
          recipientName: mockEmergencyContacts[0].name,
          channel: 'SMS',
          status: NotificationStatus.SENT,
          errorMessage: null,
          sentAt: mockTimestamp,
          createdAt: mockTimestamp,
        } as any);

      vi.spyOn(prisma.sOSNotification, 'upsert').mockResolvedValue({
        notificationId: 'notif-1',
        status: NotificationStatus.PENDING,
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post(`/api/v1/sos/${mockAlertId}/notifications/retry`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data.notifications[0].status).toBe('SENT');
    });

    it('should reject retry on an alert that has already been RESOLVED with 400 Bad Request', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        userId: mockUserId,
        status: SOSAlertStatus.RESOLVED,
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post(`/api/v1/sos/${mockAlertId}/notifications/retry`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Only ACTIVE alerts can be escalated');
    });

    it('should reject retry on an alert that has already been CANCELLED with 400 Bad Request', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        userId: mockUserId,
        status: SOSAlertStatus.CANCELLED,
      } as any);

      const token = generateToken(mockUserId);
      const res = await request(app)
        .post(`/api/v1/sos/${mockAlertId}/notifications/retry`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Only ACTIVE alerts can be escalated');
    });

    it('should reject retry by non-owner, non-admin with 403 Forbidden', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockOtherDbUser as any);
      vi.spyOn(prisma.sOSAlert, 'findUnique').mockResolvedValue({
        userId: mockUserId, // Owned by mockUserId
        status: SOSAlertStatus.ACTIVE,
      } as any);

      const token = generateToken(mockOtherUserId);
      const res = await request(app)
        .post(`/api/v1/sos/${mockAlertId}/notifications/retry`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
