export type SpotStatus = "AVAILABLE" | "ACTIVE" | "AWAITING_PAYMENT" | "LOCKED";

export type BidStatus = "LEADING" | "OUTBID" | "PAYMENT_PENDING" | "PAID" | "PAYMENT_EXPIRED" | "REFUND_PENDING" | "REFUND_FAILED" | "REFUNDED" | "FAILED";

export type CreateBidInput = { spotId: string; company: string; email: string; amountCents: number };
export type ProviderPayment = { id: string; status: string; externalReference: string | null; amountCents: number; currency: string; payerEmail: string | null };

export type PublicSpot = {
  id: string; placement: string; description: string; sizeLabel: string; tier: string; tone: string;
  status: SpotStatus; sponsor: string | null; startingAmountCents: number; currentBidCents: number | null;
  minimumBidCents: number; startsAt: string | null; endsAt: string | null; paymentDueAt: string | null;
  lockedAt: string | null; auctionRound: number;
};

export type AuctionState = {
  generatedAt: string;
  metrics: { activeAuctions: number; awaitingPayment: number; lockedSpots: number; availableSpots: number; totalSpots: number; totalRaisedCents: number };
  spots: PublicSpot[];
};

export type InternalBid = {
  id: string; spotId: string; company: string; email: string; amountCents: number; status: BidStatus;
  paymentDueAt: string | null; preferenceId: string | null; checkoutUrl: string | null;
  paymentLinkSentAt: string | null; emailAttempts: number; nextEmailAt: string | null; emailFailure: string | null;
  paymentId: string | null; paymentStatus: string | null; refundId: string | null; refundReason: string | null;
};
