import "server-only";

import type { ProviderPayment } from "@/lib/auction/types";

import {
  type CheckoutRequest,
  type CheckoutResponse,
  type PaymentProvider,
  PaymentProviderError,
} from "./types";

type Fetcher = typeof fetch;

type MercadoPagoErrorBody = {
  message?: string;
  error?: string;
  status?: number;
  cause?: Array<{ code?: string; description?: string }>;
};

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = "mercadopago" as const;
  private readonly apiBase: string;

  constructor(
    private readonly accessToken: string,
    private readonly fetcher: Fetcher = fetch,
    apiBase =
      process.env.MERCADOPAGO_API_BASE_URL?.trim() ||
      "https://api.mercadopago.com",
  ) {
    if (!accessToken) {
      throw new PaymentProviderError(
        "Falta configurar MERCADOPAGO_ACCESS_TOKEN en el servidor.",
        503,
        "MISSING_ACCESS_TOKEN",
      );
    }
    this.apiBase = apiBase.replace(/\/+$/, "");
  }

  async createCheckout(input: CheckoutRequest): Promise<CheckoutResponse> {
    const successUrl = new URL("/pago/resultado?result=success", input.baseUrl).toString();
    const pendingUrl = new URL("/pago/resultado?result=pending", input.baseUrl).toString();
    const failureUrl = new URL("/pago/resultado?result=failure", input.baseUrl).toString();
    const configuredWebhook = process.env.MERCADOPAGO_WEBHOOK_URL?.trim();
    const inferredWebhook = new URL("/api/webhooks/mercadopago", input.baseUrl);
    const notificationUrl =
      configuredWebhook || (inferredWebhook.protocol === "https:" ? inferredWebhook.toString() : undefined);

    const response = await this.fetcher(`${this.apiBase}/checkout/preferences`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `preference-${input.bid.id}`,
      },
      body: JSON.stringify({
        items: [
          {
            id: input.bid.spotId,
            title: `Startup Day 2026 · ${input.placement}`,
            description: "Oferta por un lugar en la pancarta principal",
            quantity: 1,
            currency_id: "ARS",
            unit_price: input.bid.amountCents / 100,
          },
        ],
        payer: { email: input.bid.email },
        external_reference: input.bid.id,
        metadata: { bid_id: input.bid.id, spot_id: input.bid.spotId },
        back_urls: {
          success: successUrl,
          pending: pendingUrl,
          failure: failureUrl,
        },
        auto_return: "approved",
        binary_mode: true,
        expires: true,
        expiration_date_to: input.bid.reservationExpiresAt,
        payment_methods: {
          excluded_payment_types: [
            { id: "ticket" },
            { id: "atm" },
            { id: "bank_transfer" },
          ],
        },
        statement_descriptor: "STARTUP DAY",
        ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      }),
      signal: AbortSignal.timeout(12_000),
    });

    const body = (await response.json()) as MercadoPagoErrorBody & {
      id?: string;
      init_point?: string;
      sandbox_init_point?: string;
    };
    if (!response.ok || !body.id) {
      throw mercadoPagoError("No se pudo crear el checkout", response.status, body);
    }

    const checkoutUrl =
      process.env.MERCADOPAGO_USE_SANDBOX === "1"
        ? body.sandbox_init_point ?? body.init_point
        : body.init_point ?? body.sandbox_init_point;
    if (!checkoutUrl) {
      throw new PaymentProviderError(
        "Mercado Pago no devolvió una URL de checkout.",
        502,
        "MISSING_CHECKOUT_URL",
      );
    }

    return { preferenceId: body.id, checkoutUrl };
  }

  async getPayment(paymentId: string): Promise<ProviderPayment> {
    const response = await this.fetcher(
      `${this.apiBase}/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        signal: AbortSignal.timeout(12_000),
      },
    );
    const body = (await response.json()) as MercadoPagoErrorBody & {
      id?: number | string;
      status?: string;
      external_reference?: string | null;
      transaction_amount?: number;
      currency_id?: string;
      payer?: { email?: string | null };
    };
    if (!response.ok || body.id === undefined || !body.status) {
      throw mercadoPagoError("No se pudo consultar el pago", response.status, body);
    }

    return {
      id: String(body.id),
      status: body.status,
      externalReference: body.external_reference ?? null,
      amountCents: Math.round((body.transaction_amount ?? 0) * 100),
      currency: body.currency_id ?? "",
      payerEmail: body.payer?.email ?? null,
    };
  }

  async refundPayment(paymentId: string, idempotencyKey: string) {
    const response = await this.fetcher(
      `${this.apiBase}/v1/payments/${encodeURIComponent(paymentId)}/refunds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: "{}",
        signal: AbortSignal.timeout(12_000),
      },
    );
    const body = (await response.json()) as MercadoPagoErrorBody & { id?: number | string };
    if (!response.ok || body.id === undefined) {
      throw mercadoPagoError("No se pudo reembolsar el pago", response.status, body);
    }
    return { id: String(body.id) };
  }
}

function mercadoPagoError(
  prefix: string,
  status: number,
  body: MercadoPagoErrorBody,
) {
  const detail = body.message ?? body.error ?? body.cause?.[0]?.description ?? "error desconocido";
  const providerCode = body.cause?.[0]?.code ?? body.error;
  return new PaymentProviderError(`${prefix}: ${detail}`, status || 502, providerCode);
}
