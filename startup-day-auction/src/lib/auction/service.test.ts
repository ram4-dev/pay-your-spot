import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_AUCTION_DURATION_MS } from "./constants";
import { createAuctionDatabase, type AuctionDatabase } from "./database";
import {
  AuctionError,
  applyProviderPayment,
  closeExpiredAuctions,
  completeRefund,
  createPendingBid,
  getAuctionState,
  getInternalBid,
} from "./service";

const FIRST_PAYMENT_AT = new Date("2026-08-29T15:00:00.000Z");

function approvedPayment(bidId: string, amountCents: number, id = `pay-${bidId}`) {
  return {
    id,
    status: "approved",
    externalReference: bidId,
    amountCents,
    currency: "ARS",
    payerEmail: "buyer@example.com",
  };
}

describe("auction service", () => {
  let database: AuctionDatabase;

  beforeEach(() => {
    delete process.env.AUCTION_DURATION_SECONDS;
    delete process.env.ENABLE_TEST_PAYMENT_PROVIDER;
    database = createAuctionDatabase();
  });

  afterEach(() => database.close());

  it("starts a 72-hour auction only after the first approved payment", () => {
    const bid = createPendingBid(database, {
      spotId: "new-spot",
      company: "Prisma Labs",
      email: "hola@prisma.test",
      amountCents: 15_000_000,
    }, FIRST_PAYMENT_AT);

    expect(getAuctionState(database, FIRST_PAYMENT_AT).metrics.activeAuctions).toBe(0);
    const result = applyProviderPayment(
      database,
      approvedPayment(bid.id, bid.amountCents),
      FIRST_PAYMENT_AT,
    );
    const state = getAuctionState(database, FIRST_PAYMENT_AT);
    const spot = state.spots.find((candidate) => candidate.id === "new-spot")!;

    expect(result.outcome).toBe("leading");
    expect(state.metrics.activeAuctions).toBe(1);
    expect(state.metrics.totalRaisedCents).toBe(15_000_000);
    expect(spot.startsAt).toBe(FIRST_PAYMENT_AT.toISOString());
    expect(spot.endsAt).toBe(
      new Date(FIRST_PAYMENT_AT.getTime() + DEFAULT_AUCTION_DURATION_MS).toISOString(),
    );
  });

  it("rejects offers below the real minimum", () => {
    expect(() =>
      createPendingBid(database, {
        spotId: "new-spot",
        company: "Low Bid",
        email: "low@example.com",
        amountCents: 14_999_900,
      }, FIRST_PAYMENT_AT),
    ).toThrowError(AuctionError);
  });

  it("moves leadership atomically and refunds the previous paid leader", () => {
    const first = createPendingBid(database, {
      spotId: "new-spot",
      company: "First Labs",
      email: "first@example.com",
      amountCents: 15_000_000,
    }, FIRST_PAYMENT_AT);
    applyProviderPayment(database, approvedPayment(first.id, first.amountCents), FIRST_PAYMENT_AT);

    const second = createPendingBid(database, {
      spotId: "new-spot",
      company: "Second Labs",
      email: "second@example.com",
      amountCents: 15_500_000,
    }, new Date(FIRST_PAYMENT_AT.getTime() + 1_000));
    const result = applyProviderPayment(
      database,
      approvedPayment(second.id, second.amountCents),
      new Date(FIRST_PAYMENT_AT.getTime() + 2_000),
    );

    expect(result.refundBidIds).toEqual([first.id]);
    expect(getInternalBid(database, first.id)?.status).toBe("REFUND_PENDING");
    expect(getInternalBid(database, second.id)?.status).toBe("LEADING");
    completeRefund(database, first.id, "refund-first");
    expect(getInternalBid(database, first.id)?.status).toBe("REFUNDED");
    expect(getAuctionState(database).metrics.totalRaisedCents).toBe(15_500_000);
  });

  it("locks the place and declares the leader winner exactly at 72 hours", () => {
    const bid = createPendingBid(database, {
      spotId: "new-spot",
      company: "Winner Labs",
      email: "winner@example.com",
      amountCents: 15_000_000,
    }, FIRST_PAYMENT_AT);
    applyProviderPayment(database, approvedPayment(bid.id, bid.amountCents), FIRST_PAYMENT_AT);

    const closingTime = new Date(FIRST_PAYMENT_AT.getTime() + DEFAULT_AUCTION_DURATION_MS);
    expect(closeExpiredAuctions(database, new Date(closingTime.getTime() - 1))).toBe(0);
    expect(closeExpiredAuctions(database, closingTime)).toBe(1);

    const state = getAuctionState(database, closingTime);
    expect(state.metrics.activeAuctions).toBe(0);
    expect(state.metrics.lockedSpots).toBe(1);
    expect(state.spots.find((spot) => spot.id === "new-spot")?.status).toBe("LOCKED");
    expect(getInternalBid(database, bid.id)?.status).toBe("WON");
  });

  it("refunds an approved payment that arrives after the auction closed", () => {
    const winner = createPendingBid(database, {
      spotId: "new-spot",
      company: "Winner Labs",
      email: "winner@example.com",
      amountCents: 15_000_000,
    }, FIRST_PAYMENT_AT);
    applyProviderPayment(database, approvedPayment(winner.id, winner.amountCents), FIRST_PAYMENT_AT);

    const late = createPendingBid(database, {
      spotId: "new-spot",
      company: "Late Labs",
      email: "late@example.com",
      amountCents: 15_500_000,
    }, new Date(FIRST_PAYMENT_AT.getTime() + 60_000));
    const afterClose = new Date(
      FIRST_PAYMENT_AT.getTime() + DEFAULT_AUCTION_DURATION_MS + 1,
    );
    const result = applyProviderPayment(
      database,
      approvedPayment(late.id, late.amountCents),
      afterClose,
    );

    expect(result.outcome).toBe("refund-required");
    expect(result.refundBidIds).toEqual([late.id]);
    expect(getInternalBid(database, late.id)?.refundReason).toBe("AUCTION_CLOSED");
    expect(getInternalBid(database, winner.id)?.status).toBe("WON");
    expect(getAuctionState(database, afterClose).metrics.totalRaisedCents).toBe(15_000_000);
  });

  it("refunds a lower payment confirmed after a higher leader", () => {
    const lower = createPendingBid(database, {
      spotId: "new-spot",
      company: "Lower Labs",
      email: "lower@example.com",
      amountCents: 15_000_000,
    }, FIRST_PAYMENT_AT);
    const higher = createPendingBid(database, {
      spotId: "new-spot",
      company: "Higher Labs",
      email: "higher@example.com",
      amountCents: 16_000_000,
    }, FIRST_PAYMENT_AT);

    applyProviderPayment(database, approvedPayment(higher.id, higher.amountCents), FIRST_PAYMENT_AT);
    const result = applyProviderPayment(
      database,
      approvedPayment(lower.id, lower.amountCents),
      new Date(FIRST_PAYMENT_AT.getTime() + 1_000),
    );

    expect(result.outcome).toBe("refund-required");
    expect(getInternalBid(database, lower.id)?.refundReason).toBe(
      "OUTBID_BEFORE_CONFIRMATION",
    );
    expect(getAuctionState(database).spots.find((spot) => spot.id === "new-spot")?.sponsor).toBe(
      "Higher Labs",
    );
  });
});
