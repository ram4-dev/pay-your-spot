import { randomUUID } from "node:crypto";
import { getAuctionDurationMs } from "./constants";
import { type AuctionDatabase,transaction } from "./database";
import type { AuctionState,BidStatus,ContactRecord,CreateBidInput,InternalBid,PublicBid,PublicSpot,SpotStatus,TrackedBid } from "./types";

type SpotRow={id:string;placement:string;description:string;size_label:string;tier:string;tone:string;starting_amount_cents:number;increment_amount_cents:number;status:SpotStatus;started_at:string|null;ends_at:string|null;reserved_at:string|null;leading_bid_id:string|null;auction_round:number};
type BidRow={id:string;spot_id:string;bidder_company:string;bidder_email:string;amount_cents:number;status:BidStatus;created_at:string;contacted_at:string|null};
export class AuctionError extends Error{constructor(public readonly code:string,message:string,public readonly status=400){super(message);this.name="AuctionError";}}

export function placeBid(database:AuctionDatabase,input:CreateBidInput,now=new Date()){
  closeExpiredAuctions(database,now);
  return transaction(database,()=>{
    const spot=database.prepare("SELECT * FROM spots WHERE id=?").get(input.spotId) as SpotRow|undefined;
    if(!spot)throw new AuctionError("SPOT_NOT_FOUND","El lugar seleccionado no existe.",404);
    if(spot.status==="RESERVED")throw new AuctionError("SPOT_RESERVED","Este lugar ya está reservado.",409);
    const leader=spot.leading_bid_id?database.prepare("SELECT id,amount_cents FROM bids WHERE id=?").get(spot.leading_bid_id) as {id:string;amount_cents:number}|undefined:undefined;
    const minimum=leader?leader.amount_cents+spot.increment_amount_cents:spot.starting_amount_cents;
    if(!Number.isSafeInteger(input.amountCents)||input.amountCents<minimum)throw new AuctionError("BID_TOO_LOW",`La oferta mínima es ARS ${(minimum/100).toLocaleString("es-AR")}.`,409);
    const company=input.company.trim(),email=input.email.trim().toLowerCase();
    if(company.length<2||company.length>80)throw new AuctionError("INVALID_COMPANY","Ingresá una marca válida.");
    if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)throw new AuctionError("INVALID_EMAIL","Ingresá un email válido.");
    const id=randomUUID(),nowIso=now.toISOString();
    if(leader)database.prepare("UPDATE bids SET status='OUTBID',updated_at=? WHERE id=? AND status='LEADING'").run(nowIso,leader.id);
    database.prepare("INSERT INTO bids(id,spot_id,bidder_company,bidder_email,amount_cents,status,created_at,updated_at)VALUES(?,?,?,?,?,'LEADING',?,?)").run(id,spot.id,company,email,input.amountCents,nowIso,nowIso);
    const startsAt=spot.started_at??nowIso,endsAt=spot.ends_at??new Date(now.getTime()+getAuctionDurationMs()).toISOString();
    database.prepare("UPDATE spots SET status='ACTIVE',started_at=?,ends_at=?,leading_bid_id=?,auction_round=CASE WHEN status='AVAILABLE' THEN auction_round+1 ELSE auction_round END WHERE id=?").run(startsAt,endsAt,id,spot.id);
    return getInternalBid(database,id)!;
  });
}

export function closeExpiredAuctions(database:AuctionDatabase,now=new Date()){
  return transaction(database,()=>{const nowIso=now.toISOString();database.prepare(`UPDATE bids SET status='RESERVED',updated_at=? WHERE id IN(SELECT leading_bid_id FROM spots WHERE status='ACTIVE' AND ends_at<=? AND leading_bid_id IS NOT NULL) AND status='LEADING'`).run(nowIso,nowIso);return database.prepare("UPDATE spots SET status='RESERVED',reserved_at=? WHERE status='ACTIVE' AND ends_at<=?").run(nowIso,nowIso).changes;});
}

function getSpotRanking(database:AuctionDatabase,spot:SpotRow):PublicBid[]{if(!spot.started_at)return[];const rows=database.prepare("SELECT bidder_company,amount_cents,status,created_at FROM bids WHERE spot_id=? AND created_at>=? AND status IN('LEADING','OUTBID','RESERVED','CONTACTED') ORDER BY amount_cents DESC,created_at ASC LIMIT 50").all(spot.id,spot.started_at) as Array<{bidder_company:string;amount_cents:number;status:BidStatus;created_at:string}>;return rows.map((bid,index)=>({rank:index+1,company:bid.bidder_company,amountCents:bid.amount_cents,status:bid.status,createdAt:bid.created_at}));}

export function getAuctionState(database:AuctionDatabase,now=new Date()):AuctionState{
  closeExpiredAuctions(database,now);
  const rows=database.prepare("SELECT s.*,b.bidder_company,b.amount_cents FROM spots s LEFT JOIN bids b ON b.id=s.leading_bid_id ORDER BY s.rowid").all() as Array<SpotRow&{bidder_company:string|null;amount_cents:number|null}>;
  const metrics=database.prepare(`SELECT(SELECT COUNT(*)FROM spots WHERE status='ACTIVE')active,(SELECT COUNT(*)FROM spots WHERE status='RESERVED')reserved,(SELECT COUNT(*)FROM spots WHERE status='AVAILABLE')available,(SELECT COUNT(*)FROM spots)total,COALESCE((SELECT SUM(amount_cents)FROM bids WHERE status IN('RESERVED','CONTACTED')),0)value`).get() as Record<string,number>;
  return{generatedAt:now.toISOString(),metrics:{activeAuctions:metrics.active,reservedSpots:metrics.reserved,availableSpots:metrics.available,totalSpots:metrics.total,reservedValueCents:metrics.value},spots:rows.map((r):PublicSpot=>({id:r.id,placement:r.placement,description:r.description,sizeLabel:r.size_label,tier:r.tier,tone:r.tone,status:r.status,sponsor:r.bidder_company??null,startingAmountCents:r.starting_amount_cents,currentBidCents:r.amount_cents??null,minimumBidCents:r.amount_cents===null?r.starting_amount_cents:r.amount_cents+r.increment_amount_cents,startsAt:r.started_at,endsAt:r.ends_at,reservedAt:r.reserved_at,auctionRound:r.auction_round,ranking:getSpotRanking(database,r)}))};
}

export function getInternalBid(database:AuctionDatabase,bidId:string){const row=database.prepare("SELECT * FROM bids WHERE id=?").get(bidId) as BidRow|undefined;return row?mapInternalBid(row):null;}
export function getTrackedBid(database:AuctionDatabase,bidId:string,now=new Date()):TrackedBid|null{const bid=getInternalBid(database,bidId);if(!bid)return null;const state=getAuctionState(database,now),spot=state.spots.find(s=>s.id===bid.spotId);if(!spot)return null;const at=bid.email.indexOf("@"),maskedEmail=at>0?`${bid.email[0]}${"•".repeat(Math.min(5,Math.max(2,at-1)))}${bid.email.slice(at)}`:"•••";const rank=spot.ranking.find(entry=>entry.company===bid.company&&entry.amountCents===bid.amountCents&&entry.createdAt===bid.createdAt)?.rank??null;return{id:bid.id,spotId:bid.spotId,placement:spot.placement,company:bid.company,maskedEmail,amountCents:bid.amountCents,status:bid.status,rank,spotStatus:spot.status,endsAt:spot.endsAt,reservedAt:spot.reservedAt,createdAt:bid.createdAt,contactedAt:bid.contactedAt};}
export function listContactRecords(database:AuctionDatabase,now=new Date()):ContactRecord[]{const state=getAuctionState(database,now);const spots=new Map(state.spots.map(s=>[s.id,s]));const rows=database.prepare("SELECT * FROM bids ORDER BY created_at DESC").all() as BidRow[];return rows.map(row=>{const bid=mapInternalBid(row),spot=spots.get(bid.spotId)!;return{bidId:bid.id,spotId:bid.spotId,placement:spot.placement,company:bid.company,email:bid.email,amountCents:bid.amountCents,bidStatus:bid.status,spotStatus:spot.status,rank:spot.ranking.find(entry=>entry.company===bid.company&&entry.amountCents===bid.amountCents&&entry.createdAt===bid.createdAt)?.rank??null,createdAt:bid.createdAt,contactedAt:bid.contactedAt};});}
export function markContacted(database:AuctionDatabase,bidId:string,now=new Date()){return database.prepare("UPDATE bids SET status=CASE WHEN status='RESERVED' THEN 'CONTACTED' ELSE status END,contacted_at=?,updated_at=? WHERE id=?").run(now.toISOString(),now.toISOString(),bidId).changes;}
function mapInternalBid(row:BidRow):InternalBid{return{id:row.id,spotId:row.spot_id,company:row.bidder_company,email:row.bidder_email,amountCents:row.amount_cents,status:row.status,createdAt:row.created_at,contactedAt:row.contacted_at};}
