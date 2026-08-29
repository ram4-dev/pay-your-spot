import "server-only";

import { getAuctionDatabase, type AuctionDatabase } from "@/lib/auction/database";
import {
  applyProviderPayment,
  attachCheckout,
  completeRefund,
  createPendingBid,
  failRefund,
  getAuctionState,
  getInternalBid,
  listRefundCandidates,
  markBidFailed,
} from "@/lib/auction/service";
import type { CreateBidInput, ProviderPayment } from "@/lib/auction/types";

import { getPaymentProvider } from "./provider";
import type { PaymentProvider } from "./types";

export async function createBidCheckout(
  input: CreateBidInput,
  baseUrl: string,
  dependencies?: { database?: AuctionDatabase; provider?: PaymentProvider; now?: Date },
) {
  const database = dependencies?.database ?? getAuctionDatabase();
  const provider = dependencies?.provider ?? getPaymentProvider();
  const now = dependencies?.now ?? new Date();
  const bid = createPendingBid(database, input, now);
  const spot = getAuctionState(database, now).spots.find((candidate) => candidate.id === bid.spotId)!;

  try {
    const checkout = await provider.createCheckout({
      bid,
      placement: spot.placement,
      baseUrl,
    });
    attachCheckout(database, bid.id, checkout.preferenceId, checkout.checkoutUrl, now);
    return {
      bidId: bid.id,
      checkoutUrl: checkout.checkoutUrl,
      reservationExpiresAt: bid.reservationExpiresAt,
    };
  } catch (error) {
    markBidFailed(
      database,
      bid.id,
      error instanceof Error ? error.message : "Error desconocido del proveedor",
      now,
    );
    throw error;
  }
}

export async function processPaymentById(paymentId: string) {
  const provider = getPaymentProvider();
  const payment = await provider.getPayment(paymentId);
  return settleProviderPayment(payment, { provider });
}

export async function settleProviderPayment(
  payment: ProviderPayment,
  dependencies?: { database?: AuctionDatabase; provider?: PaymentProvider; now?: Date },
) {
  const database = dependencies?.database ?? getAuctionDatabase();
  const provider = dependencies?.provider ?? getPaymentProvider();
  const now = dependencies?.now ?? new Date();
  const result = applyProviderPayment(database, payment, now);
  const refunds = await drainRefundQueue({ database, provider, now });
  return { ...result, refunds };
}

export async function approveTestBid(bidId: string) {
  const provider = getPaymentProvider();
  if (provider.name !== "test") {
    throw new Error("La confirmación manual sólo existe para el proveedor de pruebas.");
  }
  const database = getAuctionDatabase();
  const bid = getInternalBid(database, bidId);
  if (!bid) throw new Error("Oferta inexistente.");

  return settleProviderPayment(
    {
      id: `test-pay-${bid.id}`,
      status: "approved",
      externalReference: bid.id,
      amountCents: bid.amountCents,
      currency: "ARS",
      payerEmail: bid.email,
    },
    { database, provider },
  );
}

export async function drainRefundQueue(dependencies?: {
  database?: AuctionDatabase;
  provider?: PaymentProvider;
  now?: Date;
}) {
  const database = dependencies?.database ?? getAuctionDatabase();
  const provider = dependencies?.provider ?? getPaymentProvider();
  const now = dependencies?.now ?? new Date();
  const results: Array<{ bidId: string; status: "refunded" | "failed" }> = [];

  for (const bid of listRefundCandidates(database, now)) {
    try {
      const refund = await provider.refundPayment(
        bid.paymentId!,
        `refund-${bid.id}`,
      );
      completeRefund(database, bid.id, refund.id, now);
      results.push({ bidId: bid.id, status: "refunded" });
    } catch (error) {
      failRefund(
        database,
        bid.id,
        error instanceof Error ? error.message : "Error desconocido de reembolso",
        now,
      );
      results.push({ bidId: bid.id, status: "failed" });
    }
  }

  return results;
}
