import crypto from 'crypto';

export interface ProcessPaymentInput {
  amount: string;
  currency: string;
  bookingId: string;
  payerId: string;
  paymentMethod: string;
  idempotencyKey?: string;
  description?: string;
}

export interface ProcessPaymentResult {
  success: boolean;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  providerReference: string;
  errorMessage?: string;
  isSimulated: boolean;
  duplicateSuppressed?: boolean;
}

export interface ProcessRefundInput {
  amount: string;
  currency: string;
  bookingId: string;
  originalPaymentReference: string;
  idempotencyKey?: string;
  reason?: string;
}

export interface ProcessRefundResult {
  success: boolean;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  providerReference: string;
  errorMessage?: string;
  isSimulated: boolean;
  duplicateSuppressed?: boolean;
}

export interface PaymentProvider {
  processPayment(input: ProcessPaymentInput): Promise<ProcessPaymentResult>;
  processRefund(input: ProcessRefundInput): Promise<ProcessRefundResult>;
  getPaymentStatus?(
    providerReference: string
  ): Promise<ProcessPaymentResult | null> | ProcessPaymentResult | null;
}

/**
 * Standard Simulated Payment Provider for the Rydora Capstone Platform.
 *
 * SIMULATED ENVIRONMENT NOTICE:
 * This provider simulates digital payment processing for development, capstone evaluation,
 * and viva demonstrations. No actual fiat or banking funds are transferred. All transactions
 * are tagged with isSimulated: true.
 *
 * Designed to be drop-in swappable with a production gateway adapter (e.g. Razorpay, Stripe)
 * by implementing the PaymentProvider interface.
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  private processedKeys = new Map<string, ProcessPaymentResult>();

  async processPayment(input: ProcessPaymentInput): Promise<ProcessPaymentResult> {
    // 1. Verify and enforce provider-level idempotency
    if (input.idempotencyKey && this.processedKeys.has(input.idempotencyKey)) {
      const cached = this.processedKeys.get(input.idempotencyKey)!;
      return {
        ...cached,
        duplicateSuppressed: true,
      };
    }

    // 2. Deterministic failure triggers for automated testing and fault injection:
    // - Payment method 'INVALID' or containing 'FAIL'
    // - Description containing 'SIMULATE_FAILURE'
    // - Amount ending with '.99' triggers simulated bank decline
    const isExplicitFailure =
      input.paymentMethod.toUpperCase().includes('FAIL') ||
      input.paymentMethod.toUpperCase() === 'INVALID' ||
      input.description?.includes('SIMULATE_FAILURE') ||
      input.amount.endsWith('.99');

    if (isExplicitFailure) {
      const failureResult: ProcessPaymentResult = {
        success: false,
        status: 'FAILED',
        providerReference: `sim_fail_${crypto.randomUUID()}`,
        errorMessage: 'Simulated payment declined: Insufficient funds or card network rejection',
        isSimulated: true,
      };

      if (input.idempotencyKey) {
        this.processedKeys.set(input.idempotencyKey, failureResult);
      }

      return failureResult;
    }

    // 3. Deterministic pending trigger for testing asynchronous webhook/approval flows:
    // - Payment method containing 'PENDING' or description containing 'SIMULATE_PENDING'
    const isExplicitPending =
      input.paymentMethod.toUpperCase().includes('PENDING') ||
      input.description?.includes('SIMULATE_PENDING');

    if (isExplicitPending) {
      const pendingResult: ProcessPaymentResult = {
        success: true,
        status: 'PENDING',
        providerReference: `sim_pend_${crypto.randomUUID()}`,
        isSimulated: true,
      };

      if (input.idempotencyKey) {
        this.processedKeys.set(input.idempotencyKey, pendingResult);
      }

      return pendingResult;
    }

    // 4. Successful simulated transaction
    const successResult: ProcessPaymentResult = {
      success: true,
      status: 'COMPLETED',
      providerReference: `sim_pay_${crypto.randomUUID()}`,
      isSimulated: true,
    };

    if (input.idempotencyKey) {
      this.processedKeys.set(input.idempotencyKey, successResult);
    }

    return successResult;
  }

  getPaymentStatus(providerReference: string): ProcessPaymentResult | null {
    for (const res of this.processedKeys.values()) {
      if (res.providerReference === providerReference) {
        return res;
      }
    }
    return null;
  }

  clearProcessed(): void {
    this.processedKeys.clear();
  }

  async processRefund(input: ProcessRefundInput): Promise<ProcessRefundResult> {
    // 1. Verify and enforce provider-level idempotency
    if (input.idempotencyKey && this.processedKeys.has(input.idempotencyKey)) {
      const cached = this.processedKeys.get(input.idempotencyKey)! as ProcessRefundResult;
      return {
        ...cached,
        duplicateSuppressed: true,
      };
    }

    // 2. Deterministic failure triggers for automated testing and fault injection:
    // - Reason containing 'FAIL' or 'INVALID'
    // - Amount ending with '.99' triggers simulated gateway refund decline
    const isExplicitFailure =
      input.reason?.toUpperCase().includes('FAIL') ||
      input.reason?.toUpperCase().includes('SIMULATE_FAILURE') ||
      input.amount.endsWith('.99');

    if (isExplicitFailure) {
      const failureResult: ProcessRefundResult = {
        success: false,
        status: 'FAILED',
        providerReference: `sim_rf_fail_${crypto.randomUUID()}`,
        errorMessage: 'Simulated refund declined: Original transaction not settled or gateway rejection',
        isSimulated: true,
      };

      if (input.idempotencyKey) {
        this.processedKeys.set(input.idempotencyKey, failureResult as any);
      }

      return failureResult;
    }

    // 3. Deterministic pending trigger for testing asynchronous gateway refund flows:
    // - Reason containing 'PENDING'
    const isExplicitPending = input.reason?.toUpperCase().includes('PENDING');

    if (isExplicitPending) {
      const pendingResult: ProcessRefundResult = {
        success: true,
        status: 'PENDING',
        providerReference: `sim_rf_pend_${crypto.randomUUID()}`,
        isSimulated: true,
      };

      if (input.idempotencyKey) {
        this.processedKeys.set(input.idempotencyKey, pendingResult as any);
      }

      return pendingResult;
    }

    // 4. Successful simulated refund
    const successResult: ProcessRefundResult = {
      success: true,
      status: 'COMPLETED',
      providerReference: `sim_rf_${crypto.randomUUID()}`,
      isSimulated: true,
    };

    if (input.idempotencyKey) {
      this.processedKeys.set(input.idempotencyKey, successResult as any);
    }

    return successResult;
  }
}

export const defaultPaymentProvider: PaymentProvider =
  new SimulatedPaymentProvider();
