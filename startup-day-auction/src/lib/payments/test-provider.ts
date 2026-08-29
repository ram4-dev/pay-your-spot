import type { ProviderPayment } from "@/lib/auction/types";

import type { CheckoutRequest, PaymentProvider } from "./types";

export class TestPaymentProvider implements PaymentProvider {
  readonly name = "test" as const;

  async createCheckout(input: CheckoutRequest) {
    return {
      preferenceId: `test-pref-${input.bid.id}`,
      checkoutUrl: new URL(`/checkout/test/${input.bid.id}`, input.baseUrl).toString(),
    };
  }

  async getPayment(): Promise<ProviderPayment> {
    throw new Error("El proveedor de pruebas confirma pagos por bidId.");
  }

  async refundPayment(paymentId: string) {
    return { id: `test-refund-${paymentId}` };
  }
}
