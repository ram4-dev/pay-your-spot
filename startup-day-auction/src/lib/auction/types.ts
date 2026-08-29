export type SpotStatus = "AVAILABLE" | "ACTIVE" | "LOCKED";

export type BidStatus =
  | "PENDING"
  | "LEADING"
  | "REFUND_PENDING"
  | "REFUND_FAILED"
  | "REFUNDED"
  | "WON"
  | "FAILED";

export type CreateBidInput = {
  spotId: string;
  company: string;
  email: string;
  amountCents: number;
};

export type ProviderPayment = {
  id: string;
  status: string;
  externalReference: string | null;
  amountCents: number;
  currency: string;
  payerEmail: string | null;
};

export type PublicSpot = {
  id: string;
  placement: string;
  description: string;
  sizeLabel: string;
  tier: string;
  tone: string;
  status: SpotStatus;
  sponsor: string | null;
  startingAmountCents: number;
  currentBidCents: number | null;
  minimumBidCents: number;
  startsAt: string | null;
  endsAt: string | null;
  lockedAt: string | null;
  pendingCheckouts: number;
};

export type AuctionState = {
  generatedAt: string;
  metrics: {
    activeAuctions: number;
    lockedSpots: number;
    availableSpots: number;
    totalSpots: number;
    totalRaisedCents: number;
  };
  spots: PublicSpot[];
};

export type InternalBid = {
  id: string;
  spotId: string;
  company: string;
  email: string;
  amountCents: number;
  status: BidStatus;
  reservationExpiresAt: string;
  preferenceId: string | null;
  checkoutUrl: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
  refundId: string | null;
  refundReason: string | null;
};
