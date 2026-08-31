import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { InternalBid } from "@/lib/auction/types";

import { MercadoPagoProvider } from "./mercado-pago";
import { validateMercadoPagoSignature } from "./webhook-signature";

const bid: InternalBid = {
  id: "bid-123",
  spotId: "top-band",
  company: "Prisma Labs",
  email: "buyer@example.com",
  amountCents: 68_000_000,
  status: "PAYMENT_PENDING",
  paymentDueAt: "2026-08-30T16:00:00.000Z",
  preferenceId: null,
  checkoutUrl: null,
  paymentLinkSentAt: null,
  emailAttempts: 0,
  nextEmailAt: null,
  emailFailure: null,
  paymentId: null,
  paymentStatus: null,
  refundId: null,
  refundReason: null,
};

describe("MercadoPagoProvider", () => {
  afterEach(() => {
    delete process.env.MERCADOPAGO_API_BASE_URL;
  });

  it("creates an ARS preference tied to the bid without exposing the access token", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "pref-123",
          init_point: "https://www.mercadopago.com.ar/checkout/pref-123",
          sandbox_init_point: "https://sandbox.mercadopago.com/checkout/pref-123",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    const provider = new MercadoPagoProvider("private-test-token", fetcher);

    const checkout = await provider.createCheckout({
      bid,
      placement: "Franja superior",
      baseUrl: "https://auction.example.com",
    });

    expect(checkout.preferenceId).toBe("pref-123");
    const [, init] = fetcher.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.items[0]).toMatchObject({ currency_id: "ARS", unit_price: 680_000 });
    expect(body.external_reference).toBe(bid.id);
    expect(body.notification_url).toBe(
      "https://auction.example.com/api/webhooks/mercadopago",
    );
    expect(JSON.stringify(body)).not.toContain("private-test-token");
  });

  it("maps a confirmed provider payment to integer cents", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: 987,
        status: "approved",
        external_reference: bid.id,
        transaction_amount: 680000,
        currency_id: "ARS",
        payer: { email: bid.email },
      }),
    );
    const provider = new MercadoPagoProvider("private-test-token", fetcher);

    await expect(provider.getPayment("987")).resolves.toEqual({
      id: "987",
      status: "approved",
      externalReference: bid.id,
      amountCents: 68_000_000,
      currency: "ARS",
      payerEmail: bid.email,
    });
  });

  it("uses an environment-provided API base for a private payment proxy", async () => {
    process.env.MERCADOPAGO_API_BASE_URL = "https://payments-proxy.example/";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        id: 987,
        status: "approved",
        external_reference: bid.id,
        transaction_amount: 680000,
        currency_id: "ARS",
      }),
    );
    const provider = new MercadoPagoProvider("temporary-proxy-capability", fetcher);

    await provider.getPayment("987");

    expect(fetcher).toHaveBeenCalledWith(
      "https://payments-proxy.example/v1/payments/987",
      expect.any(Object),
    );
  });

  it("uses a stable idempotency key for full refunds", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ id: 321 }, { status: 201 }),
    );
    const provider = new MercadoPagoProvider("private-test-token", fetcher);

    await provider.refundPayment("987", "refund-bid-123");

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/payments/987/refunds",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Idempotency-Key": "refund-bid-123" }),
      }),
    );
  });
});

describe("Mercado Pago webhook signature", () => {
  it("validates the documented HMAC manifest in constant-time compatible form", () => {
    const secret = "webhook-secret";
    const timestamp = "1742505638683";
    const requestId = "request-123";
    const dataId = "payment-987";
    const hash = createHmac("sha256", secret)
      .update(`id:${dataId};request-id:${requestId};ts:${timestamp};`)
      .digest("hex");

    expect(
      validateMercadoPagoSignature({
        signature: `ts=${timestamp},v1=${hash}`,
        requestId,
        dataId,
        secret,
      }),
    ).toBe(true);
    expect(
      validateMercadoPagoSignature({
        signature: `ts=${timestamp},v1=${"0".repeat(64)}`,
        requestId,
        dataId,
        secret,
      }),
    ).toBe(false);
  });
});
