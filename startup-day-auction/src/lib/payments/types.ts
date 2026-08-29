import type { InternalBid, ProviderPayment } from "@/lib/auction/types";

export type CheckoutRequest = {
  bid: InternalBid;
  placement: string;
  baseUrl: string;
};

export type CheckoutResponse = {
  preferenceId: string;
  checkoutUrl: string;
};

export interface PaymentProvider {
  readonly name: "mercadopago" | "test";
  createCheckout(input: CheckoutRequest): Promise<CheckoutResponse>;
  getPayment(paymentId: string): Promise<ProviderPayment>;
  refundPayment(paymentId: string, idempotencyKey: string): Promise<{ id: string }>;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
    public readonly providerCode?: string,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
