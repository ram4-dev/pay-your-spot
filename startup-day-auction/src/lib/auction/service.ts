import { randomUUID } from "node:crypto";
import { getAuctionDurationMs, getPaymentWindowMs } from "./constants";
import { type AuctionDatabase, transaction } from "./database";
import type { AuctionState, CreateBidInput, InternalBid, ProviderPayment, PublicSpot, SpotStatus } from "./types";

type SpotRow = { id:string; placement:string; description:string; size_label:string; tier:string; tone:string; starting_amount_cents:number; increment_amount_cents:number; status:SpotStatus; started_at:string|null; ends_at:string|null; payment_due_at:string|null; locked_at:string|null; leading_bid_id:string|null; auction_round:number };
type BidRow = { id:string; spot_id:string; bidder_company:string; bidder_email:string; amount_cents:number; status:InternalBid["status"]; payment_due_at:string|null; preference_id:string|null; checkout_url:string|null; payment_link_sent_at:string|null; email_attempts:number; next_email_at:string|null; email_failure:string|null; payment_id:string|null; payment_status:string|null; refund_id:string|null; refund_reason:string|null };

export class AuctionError extends Error {
  constructor(public readonly code:string, message:string, public readonly status=400) { super(message); this.name="AuctionError"; }
}

export function placeBid(database: AuctionDatabase, input: CreateBidInput, now=new Date()) {
  closeExpiredAuctions(database, now); reopenExpiredPaymentWindows(database, now);
  return transaction(database, () => {
    const spot = database.prepare("SELECT * FROM spots WHERE id=?").get(input.spotId) as SpotRow|undefined;
    if (!spot) throw new AuctionError("SPOT_NOT_FOUND", "El lugar seleccionado no existe.", 404);
    if (spot.status === "LOCKED") throw new AuctionError("SPOT_LOCKED", "Este lugar ya fue adjudicado y pagado.", 409);
    if (spot.status === "AWAITING_PAYMENT") throw new AuctionError("PAYMENT_WINDOW_ACTIVE", "La subasta terminó y el ganador está dentro del plazo de pago.", 409);
    const leader = spot.leading_bid_id ? database.prepare("SELECT id,amount_cents FROM bids WHERE id=?").get(spot.leading_bid_id) as {id:string;amount_cents:number}|undefined : undefined;
    const minimum = leader ? leader.amount_cents + spot.increment_amount_cents : spot.starting_amount_cents;
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents < minimum) throw new AuctionError("BID_TOO_LOW", `La oferta mínima es ARS ${(minimum/100).toLocaleString("es-AR")}.`, 409);
    const company=input.company.trim(), email=input.email.trim().toLowerCase();
    if (company.length<2 || company.length>80) throw new AuctionError("INVALID_COMPANY", "Ingresá una marca válida.");
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length>254) throw new AuctionError("INVALID_EMAIL", "Ingresá un email válido.");
    const id=randomUUID(), nowIso=now.toISOString();
    if (leader) database.prepare("UPDATE bids SET status='OUTBID',updated_at=? WHERE id=? AND status='LEADING'").run(nowIso, leader.id);
    database.prepare("INSERT INTO bids (id,spot_id,bidder_company,bidder_email,amount_cents,status,created_at,updated_at) VALUES (?,?,?,?,?,'LEADING',?,?)").run(id,spot.id,company,email,input.amountCents,nowIso,nowIso);
    const startsAt=spot.started_at ?? nowIso;
    const endsAt=spot.ends_at ?? new Date(now.getTime()+getAuctionDurationMs()).toISOString();
    database.prepare("UPDATE spots SET status='ACTIVE',started_at=?,ends_at=?,leading_bid_id=?,auction_round=CASE WHEN status='AVAILABLE' THEN auction_round+1 ELSE auction_round END WHERE id=?").run(startsAt,endsAt,id,spot.id);
    return getInternalBid(database,id)!;
  });
}

export function closeExpiredAuctions(database: AuctionDatabase, now=new Date()) {
  return transaction(database, () => {
    const nowIso=now.toISOString(), due=new Date(now.getTime()+getPaymentWindowMs()).toISOString();
    database.prepare(`UPDATE bids SET status='PAYMENT_PENDING',payment_due_at=?,updated_at=? WHERE id IN
      (SELECT leading_bid_id FROM spots WHERE status='ACTIVE' AND ends_at<=? AND leading_bid_id IS NOT NULL) AND status='LEADING'`).run(due,nowIso,nowIso);
    return database.prepare("UPDATE spots SET status='AWAITING_PAYMENT',payment_due_at=? WHERE status='ACTIVE' AND ends_at<=?").run(due,nowIso).changes;
  });
}

export function reopenExpiredPaymentWindows(database: AuctionDatabase, now=new Date()) {
  return transaction(database, () => {
    const nowIso=now.toISOString();
    database.prepare(`UPDATE bids SET status='PAYMENT_EXPIRED',updated_at=? WHERE id IN
      (SELECT leading_bid_id FROM spots WHERE status='AWAITING_PAYMENT' AND payment_due_at<=? AND leading_bid_id IS NOT NULL) AND status='PAYMENT_PENDING'`).run(nowIso,nowIso);
    return database.prepare(`UPDATE spots SET status='AVAILABLE',started_at=NULL,ends_at=NULL,payment_due_at=NULL,leading_bid_id=NULL
      WHERE status='AWAITING_PAYMENT' AND payment_due_at<=?`).run(nowIso).changes;
  });
}

export function listPaymentLinkCandidates(database: AuctionDatabase, now=new Date()) {
  return database.prepare(`SELECT * FROM bids WHERE status='PAYMENT_PENDING' AND payment_link_sent_at IS NULL
    AND (next_email_at IS NULL OR next_email_at<=?) ORDER BY updated_at LIMIT 25`).all(now.toISOString()).map((r)=>mapInternalBid(r as BidRow));
}

export function attachCheckout(database: AuctionDatabase,bidId:string,preferenceId:string,checkoutUrl:string,now=new Date()) {
  database.prepare("UPDATE bids SET preference_id=?,checkout_url=?,updated_at=? WHERE id=? AND status='PAYMENT_PENDING'").run(preferenceId,checkoutUrl,now.toISOString(),bidId);
  return getInternalBid(database,bidId);
}

export function markPaymentLinkSent(database:AuctionDatabase,bidId:string,now=new Date()) {
  database.prepare("UPDATE bids SET payment_link_sent_at=?,email_attempts=email_attempts+1,next_email_at=NULL,email_failure=NULL,updated_at=? WHERE id=? AND status='PAYMENT_PENDING'").run(now.toISOString(),now.toISOString(),bidId);
}

export function failPaymentLink(database:AuctionDatabase,bidId:string,reason:string,now=new Date()) {
  const row=database.prepare("SELECT email_attempts FROM bids WHERE id=?").get(bidId) as {email_attempts:number}|undefined;
  const attempts=(row?.email_attempts??0)+1, delay=Math.min(30_000*2**(attempts-1),60*60*1000);
  database.prepare("UPDATE bids SET email_attempts=?,email_failure=?,next_email_at=?,updated_at=? WHERE id=? AND status='PAYMENT_PENDING'").run(attempts,reason.slice(0,500),new Date(now.getTime()+delay).toISOString(),now.toISOString(),bidId);
}

export function applyProviderPayment(database:AuctionDatabase,payment:ProviderPayment,now=new Date()) {
  if (!payment.externalReference) throw new AuctionError("PAYMENT_WITHOUT_BID","El pago no contiene una referencia de oferta.",422);
  reopenExpiredPaymentWindows(database,now);
  return transaction(database,()=>{
    const bid=database.prepare("SELECT * FROM bids WHERE id=?").get(payment.externalReference) as BidRow|undefined;
    if (!bid) throw new AuctionError("BID_NOT_FOUND","La oferta del pago no existe.",404);
    const owner=database.prepare("SELECT id FROM bids WHERE payment_id=? AND id<>?").get(payment.id,bid.id);
    if (owner) return {outcome:"duplicate-payment" as const,refundBidIds:[] as string[]};
    const nowIso=now.toISOString();
    if (payment.status!=="approved") {
      database.prepare("UPDATE bids SET payment_id=COALESCE(payment_id,?),payment_status=?,updated_at=? WHERE id=?").run(payment.id,payment.status,nowIso,bid.id);
      return {outcome:"not-approved" as const,refundBidIds:[] as string[]};
    }
    if (bid.status==="PAID") return {outcome:"already-processed" as const,refundBidIds:[] as string[]};
    database.prepare("UPDATE bids SET payment_id=?,payment_status=?,paid_at=COALESCE(paid_at,?),updated_at=? WHERE id=?").run(payment.id,payment.status,nowIso,nowIso,bid.id);
    const spot=database.prepare("SELECT * FROM spots WHERE id=?").get(bid.spot_id) as SpotRow;
    const valid=bid.status==="PAYMENT_PENDING" && spot.status==="AWAITING_PAYMENT" && spot.leading_bid_id===bid.id && !!spot.payment_due_at && new Date(spot.payment_due_at).getTime()>now.getTime() && payment.currency==="ARS" && payment.amountCents===bid.amount_cents;
    if (!valid) {
      const reason=payment.currency!=="ARS"?"CURRENCY_MISMATCH":payment.amountCents!==bid.amount_cents?"AMOUNT_MISMATCH":"PAYMENT_WINDOW_EXPIRED";
      database.prepare("UPDATE bids SET status='REFUND_PENDING',refund_reason=?,next_refund_at=?,updated_at=? WHERE id=?").run(reason,nowIso,nowIso,bid.id);
      return {outcome:"refund-required" as const,refundBidIds:[bid.id]};
    }
    database.prepare("UPDATE bids SET status='PAID',updated_at=? WHERE id=?").run(nowIso,bid.id);
    database.prepare("UPDATE spots SET status='LOCKED',locked_at=?,payment_due_at=NULL WHERE id=?").run(nowIso,spot.id);
    return {outcome:"paid" as const,refundBidIds:[] as string[]};
  });
}

export function completeRefund(database:AuctionDatabase,bidId:string,refundId:string,now=new Date()) { database.prepare("UPDATE bids SET status='REFUNDED',refund_id=?,refunded_at=?,updated_at=?,next_refund_at=NULL WHERE id=? AND status IN ('REFUND_PENDING','REFUND_FAILED')").run(refundId,now.toISOString(),now.toISOString(),bidId); }
export function failRefund(database:AuctionDatabase,bidId:string,reason:string,now=new Date()) {
  const row=database.prepare("SELECT refund_attempts FROM bids WHERE id=?").get(bidId) as {refund_attempts:number}|undefined;
  const attempts=(row?.refund_attempts??0)+1, delay=Math.min(30_000*2**(attempts-1),60*60*1000);
  database.prepare("UPDATE bids SET status='REFUND_FAILED',refund_attempts=?,failure_reason=?,next_refund_at=?,updated_at=? WHERE id=? AND status IN ('REFUND_PENDING','REFUND_FAILED')").run(attempts,reason.slice(0,500),new Date(now.getTime()+delay).toISOString(),now.toISOString(),bidId);
}
export function listRefundCandidates(database:AuctionDatabase,now=new Date()) { return database.prepare("SELECT * FROM bids WHERE status IN ('REFUND_PENDING','REFUND_FAILED') AND (next_refund_at IS NULL OR next_refund_at<=?) AND payment_id IS NOT NULL ORDER BY created_at LIMIT 25").all(now.toISOString()).map((r)=>mapInternalBid(r as BidRow)); }

export function getAuctionState(database:AuctionDatabase,now=new Date()):AuctionState {
  closeExpiredAuctions(database,now); reopenExpiredPaymentWindows(database,now);
  const rows=database.prepare("SELECT s.*,b.bidder_company,b.amount_cents FROM spots s LEFT JOIN bids b ON b.id=s.leading_bid_id ORDER BY s.rowid").all() as Array<SpotRow&{bidder_company:string|null;amount_cents:number|null}>;
  const m=database.prepare(`SELECT
    (SELECT COUNT(*) FROM spots WHERE status='ACTIVE') active_auctions,
    (SELECT COUNT(*) FROM spots WHERE status='AWAITING_PAYMENT') awaiting_payment,
    (SELECT COUNT(*) FROM spots WHERE status='LOCKED') locked_spots,
    (SELECT COUNT(*) FROM spots WHERE status='AVAILABLE') available_spots,
    (SELECT COUNT(*) FROM spots) total_spots,
    COALESCE((SELECT SUM(amount_cents) FROM bids WHERE status='PAID'),0) total_raised_cents`).get() as Record<string,number>;
  return {generatedAt:now.toISOString(),metrics:{activeAuctions:m.active_auctions,awaitingPayment:m.awaiting_payment,lockedSpots:m.locked_spots,availableSpots:m.available_spots,totalSpots:m.total_spots,totalRaisedCents:m.total_raised_cents},spots:rows.map((r):PublicSpot=>({id:r.id,placement:r.placement,description:r.description,sizeLabel:r.size_label,tier:r.tier,tone:r.tone,status:r.status,sponsor:r.bidder_company??null,startingAmountCents:r.starting_amount_cents,currentBidCents:r.amount_cents??null,minimumBidCents:r.amount_cents===null?r.starting_amount_cents:r.amount_cents+r.increment_amount_cents,startsAt:r.started_at,endsAt:r.ends_at,paymentDueAt:r.payment_due_at,lockedAt:r.locked_at,auctionRound:r.auction_round}))};
}

export function getInternalBid(database:AuctionDatabase,bidId:string) { const row=database.prepare("SELECT * FROM bids WHERE id=?").get(bidId) as BidRow|undefined; return row?mapInternalBid(row):null; }
function mapInternalBid(r:BidRow):InternalBid { return {id:r.id,spotId:r.spot_id,company:r.bidder_company,email:r.bidder_email,amountCents:r.amount_cents,status:r.status,paymentDueAt:r.payment_due_at,preferenceId:r.preference_id,checkoutUrl:r.checkout_url,paymentLinkSentAt:r.payment_link_sent_at,emailAttempts:r.email_attempts,nextEmailAt:r.next_email_at,emailFailure:r.email_failure,paymentId:r.payment_id,paymentStatus:r.payment_status,refundId:r.refund_id,refundReason:r.refund_reason}; }
