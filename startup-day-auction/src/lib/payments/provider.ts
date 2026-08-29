import "server-only";

import { MercadoPagoProvider } from "./mercado-pago";
import { TestPaymentProvider } from "./test-provider";
import { type PaymentProvider, PaymentProviderError } from "./types";

export function getPaymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER === "test") {
    if (process.env.ENABLE_TEST_PAYMENT_PROVIDER !== "1") {
      throw new PaymentProviderError(
        "El proveedor de pagos de prueba está deshabilitado.",
        503,
        "TEST_PROVIDER_DISABLED",
      );
    }
    return new TestPaymentProvider();
  }

  return new MercadoPagoProvider(process.env.MERCADOPAGO_ACCESS_TOKEN ?? "");
}
