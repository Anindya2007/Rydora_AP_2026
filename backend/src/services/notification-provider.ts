import crypto from 'crypto';

export interface EmergencyNotificationPayload {
  alertId: string;
  userName: string;
  recipientPhone: string;
  recipientName: string;
  message: string | null;
  latitude: string | null;
  longitude: string | null;
  mapsUrl: string | null;
  rideSummary: string | null;
  timestamp: Date;
  idempotencyKey?: string;
}

export interface EmergencyNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  duplicateSuppressed?: boolean;
}

export interface EmergencyNotificationProvider {
  sendEmergencyNotification(
    payload: EmergencyNotificationPayload
  ): Promise<EmergencyNotificationResult>;
  getProcessedNotification?(
    idempotencyKey: string
  ): Promise<EmergencyNotificationResult | null> | EmergencyNotificationResult | null | undefined;
}

/**
 * Standard Simulated Emergency Notification Provider.
 *
 * Implements SMS dispatch simulation for development, testing, and production fallback.
 *
 * EXACTLY-ONCE DELIVERY LIMITATION NOTICE:
 * In distributed systems and telecommunications (SMS over SMPP/cellular SS7), true
 * end-to-end "exactly-once" delivery to a human handset is theoretically impossible
 * due to the Two Generals' Problem and mobile carrier tower retry protocols.
 * Upstream idempotency keys ensure the provider/aggregator API never initiates duplicate
 * SMS sends for the same event, but downstream carrier networks operate under
 * at-least-once delivery semantics.
 */
export class SimulatedEmergencyNotificationProvider
  implements EmergencyNotificationProvider
{
  private processedKeys = new Map<string, EmergencyNotificationResult>();

  async sendEmergencyNotification(
    payload: EmergencyNotificationPayload
  ): Promise<EmergencyNotificationResult> {
    // 1. Verify and enforce provider-level idempotency
    if (payload.idempotencyKey && this.processedKeys.has(payload.idempotencyKey)) {
      const cached = this.processedKeys.get(payload.idempotencyKey)!;
      return {
        ...cached,
        duplicateSuppressed: true,
      };
    }

    // 2. Check for simulated failure trigger (e.g. phone containing '000000' or explicit test error)
    if (payload.recipientPhone.includes('000000') || payload.recipientPhone === 'INVALID_PHONE') {
      const failureResult: EmergencyNotificationResult = {
        success: false,
        error: `Provider delivery failed: Carrier network unreachable for ${payload.recipientPhone}`,
      };
      if (payload.idempotencyKey) {
        this.processedKeys.set(payload.idempotencyKey, failureResult);
      }
      return failureResult;
    }

    // 3. Generate unique provider tracking identifier
    const messageId = `sim_msg_${crypto.randomUUID()}`;
    const successResult: EmergencyNotificationResult = {
      success: true,
      messageId,
    };

    if (payload.idempotencyKey) {
      this.processedKeys.set(payload.idempotencyKey, successResult);
    }

    return successResult;
  }

  getProcessedNotification(idempotencyKey: string): EmergencyNotificationResult | null {
    return this.processedKeys.get(idempotencyKey) || null;
  }

  clearProcessed(): void {
    this.processedKeys.clear();
  }
}

export const defaultNotificationProvider: EmergencyNotificationProvider =
  new SimulatedEmergencyNotificationProvider();
