import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuctionDatabase, type AuctionDatabase } from "@/lib/auction/database";
import { getAuctionState, getInternalBid } from "@/lib/auction/service";
import type { ProviderPayment } from "@/lib/auction/types";

import { createBidCheckout, settleProviderPayment } from "./orchestrator";
import type { CheckoutRequest, PaymentProvider } from "./types";

class RecordingProvider implements PaymentProvider {
  readonly name = "test" as const;
  readonly refunds = vi.fn(async (paymentId: string, idempotencyKey: string) => {
    void idempotencyKey;
    return { id: `refund-${paymentId}` };
  });

  async createCheckout(input: CheckoutRequest) {
    return {
      preferenceId: `preference-${input.bid.id}`,
      checkoutUrl: `https://checkout.test/${input.bid.id}`,
    };
  }

  async getPayment(): Promise<ProviderPayment> {
    throw new Error("not used");
  }

  refundPayment(paymentId: string, idempotencyKey: string) {
    return this.refunds(paymentId, idempotencyKey);
  }
}

describe("payment orchestration", () => {
  let database: AuctionDatabase;
  let provider: RecordingProvider;
  const startedAt = new Date("2026-08-29T15:00:00.000Z");

  beforeEach(() => {
    database = createAuctionDatabase();
    provider = new RecordingProvider();
  });

  afterEach(() => database.close());

  it("creates checkout, promotes the paid bid, and automatically refunds the previous leader", async () => {
    const first = await createBidCheckout(
      {
        spotId: "new-spot",
        company: "First Labs",
        email: "first@example.com",
        amountCents: 15_000_000,
      },
      "https://auction.test",
      { database, provider, now: startedAt },
    );
    await settleProviderPayment(
      approved(first.bidId, 15_000_000, "payment-first"),
      { database, provider, now: startedAt },
    );

    const second = await createBidCheckout(
      {
        spotId: "new-spot",
        company: "Second Labs",
        email: "second@example.com",
        amountCents: 15_500_000,
      },
      "https://auction.test",
      { database, provider, now: new Date(startedAt.getTime() + 1_000) },
    );
    await settleProviderPayment(
      approved(second.bidId, 15_500_000, "payment-second"),
      { database, provider, now: new Date(startedAt.getTime() + 2_000) },
    );

    expect(provider.refunds).toHaveBeenCalledOnce();
    expect(provider.refunds).toHaveBeenCalledWith(
      "payment-first",
      `refund-${first.bidId}`,
    );
    expect(getInternalBid(database, first.bidId)?.status).toBe("REFUNDED");
    expect(getInternalBid(database, second.bidId)?.status).toBe("LEADING");
    expect(getAuctionState(database).metrics.totalRaisedCents).toBe(15_500_000);
  });
});

function approved(bidId: string, amountCents: number, paymentId: string): ProviderPayment {
  return {
    id: paymentId,
    status: "approved",
    externalReference: bidId,
    amountCents,
    currency: "ARS",
    payerEmail: "buyer@example.com",
  };
}
