export type SpotStatus = "AVAILABLE" | "ACTIVE" | "RESERVED";
export type BidStatus = "LEADING" | "OUTBID" | "RESERVED" | "CONTACTED" | "FAILED";
export type CreateBidInput = { spotId:string; company:string; email:string; amountCents:number };
export type PublicBid = { rank:number; company:string; amountCents:number; status:BidStatus; createdAt:string };

export type PublicSpot = {
  id:string; placement:string; description:string; sizeLabel:string; tier:string; tone:string;
  status:SpotStatus; sponsor:string|null; startingAmountCents:number; currentBidCents:number|null;
  minimumBidCents:number; startsAt:string|null; endsAt:string|null; reservedAt:string|null;
  auctionRound:number; ranking:PublicBid[];
};

export type AuctionState = {
  generatedAt:string;
  metrics:{ activeAuctions:number; reservedSpots:number; availableSpots:number; totalSpots:number; reservedValueCents:number };
  spots:PublicSpot[];
};

export type InternalBid = {
  id:string; spotId:string; company:string; email:string; amountCents:number; status:BidStatus;
  createdAt:string; contactedAt:string|null;
};

export type TrackedBid = {
  id:string; spotId:string; placement:string; company:string; maskedEmail:string; amountCents:number;
  status:BidStatus; rank:number|null; spotStatus:SpotStatus; endsAt:string|null; reservedAt:string|null;
  createdAt:string; contactedAt:string|null;
};

export type ContactRecord = {
  bidId:string; spotId:string; placement:string; company:string; email:string; amountCents:number;
  bidStatus:BidStatus; spotStatus:SpotStatus; rank:number|null; createdAt:string; contactedAt:string|null;
};
