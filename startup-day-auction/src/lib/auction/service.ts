import { randomUUID } from "node:crypto";

import {
  DEFAULT_CHECKOUT_RESERVATION_MS,
  getAuctionDurationMs,
} from "./constants";
import { type AuctionDatabase, transaction } from "./database";
import type {
  AuctionState,
  CreateBidInput,
  InternalBid,
  ProviderPayment,
  PublicSpot,
  SpotStatus,
} from "./types";

type SpotRow = {
  id: string;
  placement: string;
  description: string;
  size_label: string;
  tier: string;
  tone: string;
  starting_amount_cents: number;
  increment_amount_cents: number;
  status: SpotStatus;
  started_at: string | null;
  ends_at: string | null;
  locked_at: string | null;
  leading_bid_id: string | null;
};

type BidRow = {
  id: string;
  spot_id: string;
  bidder_company: string;
  bidder_email: string;
  amount_cents: number;
  status: InternalBid["status"];
  reservation_expires_at: string;
  preference_id: string | null;
  checkout_url: string | null;
  payment_id: string | null;
  payment_status: string | null;
  refund_id: string | null;
  refund_reason: string | null;
};

export class AuctionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AuctionError";
  }
}

export function createPendingBid(
  database: AuctionDatabase,
  input: CreateBidInput,
  now = new Date(),
) {
  closeExpiredAuctions(database, now);

  return transaction(database, () => {
    const spot = database
      .prepare("SELECT * FROM spots WHERE id = ?")
      .get(input.spotId) as SpotRow | undefined;

    if (!spot) {
      throw new AuctionError("SPOT_NOT_FOUND", "El lugar seleccionado no existe.", 404);
    }
    if (spot.status === "LOCKED") {
      throw new AuctionError("SPOT_LOCKED", "La subasta de este lugar ya cerró.", 409);
    }

    const leader = spot.leading_bid_id
      ? (database
          .prepare("SELECT amount_cents FROM bids WHERE id = ?")
          .get(spot.leading_bid_id) as { amount_cents: number } | undefined)
      : undefined;
    const minimum = leader
      ? leader.amount_cents + spot.increment_amount_cents
      : spot.starting_amount_cents;

    if (!Number.isSafeInteger(input.amountCents) || input.amountCents < minimum) {
      throw new AuctionError(
        "BID_TOO_LOW",
        `La oferta mínima es ARS ${(minimum / 100).toLocaleString("es-AR")}.`,
        409,
      );
    }

    const company = input.company.trim();
    const email = input.email.trim().toLowerCase();
    if (company.length < 2 || company.length > 80) {
      throw new AuctionError("INVALID_COMPANY", "Ingresá una marca válida.");
    }
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
      throw new AuctionError("INVALID_EMAIL", "Ingresá un email válido.");
    }

    const id = randomUUID();
    const nowIso = now.toISOString();
    const reservationEnd = new Date(now.getTime() + DEFAULT_CHECKOUT_RESERVATION_MS);
    const effectiveReservationEnd =
      spot.ends_at && new Date(spot.ends_at) < reservationEnd
        ? new Date(spot.ends_at)
        : reservationEnd;

    database
      .prepare(`
        INSERT INTO bids (
          id, spot_id, bidder_company, bidder_email, amount_cents, status,
          reservation_expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
      `)
      .run(
        id,
        spot.id,
        company,
        email,
        input.amountCents,
        effectiveReservationEnd.toISOString(),
        nowIso,
        nowIso,
      );

    return getInternalBid(database, id)!;
  });
}

export function attachCheckout(
  database: AuctionDatabase,
  bidId: string,
  preferenceId: string,
  checkoutUrl: string,
  now = new Date(),
) {
  database
    .prepare(`
      UPDATE bids
      SET preference_id = ?, checkout_url = ?, updated_at = ?
      WHERE id = ? AND status = 'PENDING'
    `)
    .run(preferenceId, checkoutUrl, now.toISOString(), bidId);
  return getInternalBid(database, bidId);
}

export function markBidFailed(
  database: AuctionDatabase,
  bidId: string,
  reason: string,
  now = new Date(),
) {
  database
    .prepare(`
      UPDATE bids
      SET status = 'FAILED', failure_reason = ?, updated_at = ?
      WHERE id = ? AND status = 'PENDING'
    `)
    .run(reason.slice(0, 500), now.toISOString(), bidId);
}

export function applyProviderPayment(
  database: AuctionDatabase,
  payment: ProviderPayment,
  now = new Date(),
) {
  if (!payment.externalReference) {
    throw new AuctionError(
      "PAYMENT_WITHOUT_BID",
      "El pago no contiene una referencia de oferta.",
      422,
    );
  }

  return transaction(database, () => {
    closeExpiredInsideTransaction(database, now);

    const bid = database
      .prepare("SELECT * FROM bids WHERE id = ?")
      .get(payment.externalReference) as BidRow | undefined;
    if (!bid) {
      throw new AuctionError("BID_NOT_FOUND", "La oferta del pago no existe.", 404);
    }

    const paymentOwner = database
      .prepare("SELECT id FROM bids WHERE payment_id = ? AND id <> ?")
      .get(payment.id, bid.id) as { id: string } | undefined;
    if (paymentOwner) {
      return { outcome: "duplicate-payment" as const, refundBidIds: [] as string[] };
    }

    const nowIso = now.toISOString();
    if (payment.status !== "approved") {
      const terminal = ["rejected", "cancelled", "canceled", "expired"].includes(
        payment.status,
      );
      database
        .prepare(`
          UPDATE bids
          SET payment_id = COALESCE(payment_id, ?), payment_status = ?,
              status = CASE WHEN ? AND status = 'PENDING' THEN 'FAILED' ELSE status END,
              updated_at = ?
          WHERE id = ?
        `)
        .run(payment.id, payment.status, terminal ? 1 : 0, nowIso, bid.id);
      return { outcome: "not-approved" as const, refundBidIds: [] as string[] };
    }

    if (["LEADING", "WON", "REFUND_PENDING", "REFUND_FAILED", "REFUNDED"].includes(bid.status)) {
      return { outcome: "already-processed" as const, refundBidIds: [] as string[] };
    }

    database
      .prepare(`
        UPDATE bids
        SET payment_id = ?, payment_status = ?, paid_at = COALESCE(paid_at, ?), updated_at = ?
        WHERE id = ?
      `)
      .run(payment.id, payment.status, nowIso, nowIso, bid.id);

    const spot = database
      .prepare("SELECT * FROM spots WHERE id = ?")
      .get(bid.spot_id) as SpotRow;
    const leader = spot.leading_bid_id
      ? (database
          .prepare("SELECT id, amount_cents FROM bids WHERE id = ?")
          .get(spot.leading_bid_id) as { id: string; amount_cents: number } | undefined)
      : undefined;

    let refundReason: string | null = null;
    if (payment.currency !== "ARS") refundReason = "CURRENCY_MISMATCH";
    else if (payment.amountCents !== bid.amount_cents) refundReason = "AMOUNT_MISMATCH";
    else if (spot.status === "LOCKED") refundReason = "AUCTION_CLOSED";
    else if (spot.ends_at && new Date(spot.ends_at).getTime() <= now.getTime()) {
      refundReason = "AUCTION_CLOSED";
    } else if (leader && bid.amount_cents <= leader.amount_cents) {
      refundReason = "OUTBID_BEFORE_CONFIRMATION";
    }

    if (refundReason) {
      database
        .prepare(`
          UPDATE bids SET status = 'REFUND_PENDING', refund_reason = ?,
            next_refund_at = ?, updated_at = ? WHERE id = ?
        `)
        .run(refundReason, nowIso, nowIso, bid.id);
      return { outcome: "refund-required" as const, refundBidIds: [bid.id] };
    }

    const refunds: string[] = [];
    if (leader) {
      database
        .prepare(`
          UPDATE bids SET status = 'REFUND_PENDING', refund_reason = 'OUTBID',
            next_refund_at = ?, updated_at = ? WHERE id = ? AND status = 'LEADING'
        `)
        .run(nowIso, nowIso, leader.id);
      refunds.push(leader.id);
    }

    const startsAt = spot.started_at ?? nowIso;
    const endsAt =
      spot.ends_at ?? new Date(now.getTime() + getAuctionDurationMs()).toISOString();
    database
      .prepare(`
        UPDATE bids SET status = 'LEADING', updated_at = ? WHERE id = ?
      `)
      .run(nowIso, bid.id);
    database
      .prepare(`
        UPDATE spots SET status = 'ACTIVE', started_at = ?, ends_at = ?,
          leading_bid_id = ? WHERE id = ?
      `)
      .run(startsAt, endsAt, bid.id, spot.id);

    return { outcome: "leading" as const, refundBidIds: refunds };
  });
}

export function completeRefund(
  database: AuctionDatabase,
  bidId: string,
  refundId: string,
  now = new Date(),
) {
  database
    .prepare(`
      UPDATE bids SET status = 'REFUNDED', refund_id = ?, refunded_at = ?,
        updated_at = ?, next_refund_at = NULL
      WHERE id = ? AND status IN ('REFUND_PENDING', 'REFUND_FAILED')
    `)
    .run(refundId, now.toISOString(), now.toISOString(), bidId);
}

export function failRefund(
  database: AuctionDatabase,
  bidId: string,
  reason: string,
  now = new Date(),
) {
  const row = database
    .prepare("SELECT refund_attempts FROM bids WHERE id = ?")
    .get(bidId) as { refund_attempts: number } | undefined;
  const attempts = (row?.refund_attempts ?? 0) + 1;
  const retryDelay = Math.min(30_000 * 2 ** (attempts - 1), 60 * 60 * 1000);
  database
    .prepare(`
      UPDATE bids SET status = 'REFUND_FAILED', refund_attempts = ?,
        failure_reason = ?, next_refund_at = ?, updated_at = ?
      WHERE id = ? AND status IN ('REFUND_PENDING', 'REFUND_FAILED')
    `)
    .run(
      attempts,
      reason.slice(0, 500),
      new Date(now.getTime() + retryDelay).toISOString(),
      now.toISOString(),
      bidId,
    );
}

export function listRefundCandidates(database: AuctionDatabase, now = new Date()) {
  return database
    .prepare(`
      SELECT * FROM bids
      WHERE status IN ('REFUND_PENDING', 'REFUND_FAILED')
        AND (next_refund_at IS NULL OR next_refund_at <= ?)
        AND payment_id IS NOT NULL
      ORDER BY created_at ASC
      LIMIT 25
    `)
    .all(now.toISOString())
    .map((row) => mapInternalBid(row as BidRow));
}

export function closeExpiredAuctions(database: AuctionDatabase, now = new Date()) {
  return transaction(database, () => closeExpiredInsideTransaction(database, now));
}

function closeExpiredInsideTransaction(database: AuctionDatabase, now: Date) {
  const nowIso = now.toISOString();
  database
    .prepare(`
      UPDATE bids SET status = 'WON', updated_at = ?
      WHERE id IN (
        SELECT leading_bid_id FROM spots
        WHERE status = 'ACTIVE' AND ends_at <= ? AND leading_bid_id IS NOT NULL
      ) AND status = 'LEADING'
    `)
    .run(nowIso, nowIso);
  return database
    .prepare(`
      UPDATE spots SET status = 'LOCKED', locked_at = ?
      WHERE status = 'ACTIVE' AND ends_at <= ?
    `)
    .run(nowIso, nowIso).changes;
}

export function getAuctionState(database: AuctionDatabase, now = new Date()): AuctionState {
  closeExpiredAuctions(database, now);
  const rows = database
    .prepare(`
      SELECT s.*, b.bidder_company, b.amount_cents,
        (
          SELECT COUNT(*) FROM bids pending
          WHERE pending.spot_id = s.id AND pending.status = 'PENDING'
            AND pending.reservation_expires_at > ?
        ) AS pending_checkouts
      FROM spots s
      LEFT JOIN bids b ON b.id = s.leading_bid_id
      ORDER BY s.rowid
    `)
    .all(now.toISOString()) as Array<
      SpotRow & {
        bidder_company: string | null;
        amount_cents: number | null;
        pending_checkouts: number;
      }
    >;

  const metrics = database
    .prepare(`
      SELECT
        (SELECT COUNT(*) FROM spots WHERE status = 'ACTIVE') AS active_auctions,
        (SELECT COUNT(*) FROM spots WHERE status = 'LOCKED') AS locked_spots,
        (SELECT COUNT(*) FROM spots WHERE status = 'AVAILABLE') AS available_spots,
        (SELECT COUNT(*) FROM spots) AS total_spots,
        COALESCE((SELECT SUM(amount_cents) FROM bids WHERE status IN ('LEADING', 'WON')), 0) AS total_raised_cents
    `)
    .get() as {
      active_auctions: number;
      locked_spots: number;
      available_spots: number;
      total_spots: number;
      total_raised_cents: number;
    };

  return {
    generatedAt: now.toISOString(),
    metrics: {
      activeAuctions: metrics.active_auctions,
      lockedSpots: metrics.locked_spots,
      availableSpots: metrics.available_spots,
      totalSpots: metrics.total_spots,
      totalRaisedCents: metrics.total_raised_cents,
    },
    spots: rows.map((row): PublicSpot => {
      const currentBidCents = row.amount_cents ?? null;
      return {
        id: row.id,
        placement: row.placement,
        description: row.description,
        sizeLabel: row.size_label,
        tier: row.tier,
        tone: row.tone,
        status: row.status,
        sponsor: row.bidder_company ?? null,
        startingAmountCents: row.starting_amount_cents,
        currentBidCents,
        minimumBidCents:
          currentBidCents === null
            ? row.starting_amount_cents
            : currentBidCents + row.increment_amount_cents,
        startsAt: row.started_at,
        endsAt: row.ends_at,
        lockedAt: row.locked_at,
        pendingCheckouts: row.pending_checkouts,
      };
    }),
  };
}

export function getInternalBid(database: AuctionDatabase, bidId: string) {
  const row = database
    .prepare("SELECT * FROM bids WHERE id = ?")
    .get(bidId) as BidRow | undefined;
  return row ? mapInternalBid(row) : null;
}

function mapInternalBid(row: BidRow): InternalBid {
  return {
    id: row.id,
    spotId: row.spot_id,
    company: row.bidder_company,
    email: row.bidder_email,
    amountCents: row.amount_cents,
    status: row.status,
    reservationExpiresAt: row.reservation_expires_at,
    preferenceId: row.preference_id,
    checkoutUrl: row.checkout_url,
    paymentId: row.payment_id,
    paymentStatus: row.payment_status,
    refundId: row.refund_id,
    refundReason: row.refund_reason,
  };
}
