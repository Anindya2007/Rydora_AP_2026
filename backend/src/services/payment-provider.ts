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

export interface PaymentProvider {
  processPayment(input: ProcessPaymentInput): Promise<ProcessPaymentResult>;
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
}

export const defaultPaymentProvider: PaymentProvider =
  new SimulatedPaymentProvider();
