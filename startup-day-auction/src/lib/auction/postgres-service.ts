import { randomUUID } from "node:crypto";
import postgres from "postgres";

import { getAuctionDurationMs } from "./constants";
import { MAX_LOGO_BYTES,MAX_LOGO_MB } from "./logo";
import { AuctionError } from "./service";
import { publicLogoUrl } from "./supabase-storage";
import type { AuctionState,BidStatus,ContactRecord,CreateBidInput,InternalBid,PublicBid,PublicSpot,SpotStatus,TrackedBid } from "./types";

type Queryable=postgres.Sql|postgres.TransactionSql;
type DateValue=Date|string|null;
type SpotRow={id:string;placement:string;description:string;size_label:string;tier:string;tone:string;starting_amount_cents:number|string;increment_amount_cents:number|string;status:SpotStatus;started_at:DateValue;ends_at:DateValue;reserved_at:DateValue;leading_bid_id:string|null;auction_round:number;sort_order:number};
type BidRow={id:string;spot_id:string;bidder_company:string;bidder_email:string;amount_cents:number|string;status:BidStatus;created_at:DateValue;contacted_at:DateValue;bidder_logo:Uint8Array|null;logo_mime_type:"image/png"|"image/jpeg"|null;logo_storage_path:string|null};
type RankingRow={id:string;spot_id:string;bidder_company:string;amount_cents:number|string;status:BidStatus;created_at:DateValue;logo_mime_type:string|null;logo_storage_path:string|null};

const globalForPostgres=globalThis as typeof globalThis&{startupDayPostgres?:postgres.Sql};

function getPostgres(){
  if(globalForPostgres.startupDayPostgres)return globalForPostgres.startupDayPostgres;
  const url=process.env.POSTGRES_URL;
  if(!url)throw new Error("POSTGRES_URL is required for Supabase persistence");
  globalForPostgres.startupDayPostgres=postgres(url,{max:1,prepare:false,connect_timeout:15,idle_timeout:20});
  return globalForPostgres.startupDayPostgres;
}

const amount=(value:number|string|null|undefined)=>Number(value??0);
const iso=(value:DateValue)=>value instanceof Date?value.toISOString():value?new Date(value).toISOString():null;
const logoUrl=(id:string,mime:string|null|undefined,path:string|null|undefined)=>path?publicLogoUrl(path):mime?`/api/logos/${id}`:null;

async function closeExpiredWith(sql:Queryable,now:Date){
  const nowIso=now.toISOString();
  await sql`update public.bids set status='RESERVED',updated_at=${nowIso} where id in (select leading_bid_id from public.spots where status='ACTIVE' and ends_at<=${nowIso} and leading_bid_id is not null) and status='LEADING'`;
  const rows=await sql`update public.spots set status='RESERVED',reserved_at=${nowIso} where status='ACTIVE' and ends_at<=${nowIso} returning id`;
  return rows.length;
}

export async function closeExpiredPostgresAuctions(now=new Date()){
  return getPostgres().begin(sql=>closeExpiredWith(sql,now));
}

export async function placePostgresBid(input:CreateBidInput,now=new Date()):Promise<InternalBid>{
  const database=getPostgres();
  return database.begin(async sql=>{
    await closeExpiredWith(sql,now);
    const [spot]=await sql<SpotRow[]>`select * from public.spots where id=${input.spotId} for update`;
    if(!spot)throw new AuctionError("SPOT_NOT_FOUND","El lugar seleccionado no existe.",404);
    if(spot.status==="RESERVED")throw new AuctionError("SPOT_RESERVED","Este lugar ya está reservado.",409);
    const [leader]=spot.leading_bid_id?await sql<Array<{id:string;amount_cents:number|string}>>`select id,amount_cents from public.bids where id=${spot.leading_bid_id}`:[];
    const minimum=leader?amount(leader.amount_cents)+amount(spot.increment_amount_cents):amount(spot.starting_amount_cents);
    if(!Number.isSafeInteger(input.amountCents)||input.amountCents<minimum)throw new AuctionError("BID_TOO_LOW",`La oferta mínima es ARS ${(minimum/100).toLocaleString("es-AR")}.`,409);
    const company=input.company.trim(),email=input.email.trim().toLowerCase();
    if(company.length<2||company.length>80)throw new AuctionError("INVALID_COMPANY","Ingresá una marca válida.");
    if(!/^\S+@\S+\.\S+$/.test(email)||email.length>254)throw new AuctionError("INVALID_EMAIL","Ingresá un email válido.");
    if(!input.logoStoragePath&&!input.logoBytes)throw new AuctionError("INVALID_LOGO",`Subí un logo PNG o JPG de hasta ${MAX_LOGO_MB} MB.`);
    if(input.logoBytes&&(input.logoBytes.byteLength===0||input.logoBytes.byteLength>MAX_LOGO_BYTES))throw new AuctionError("INVALID_LOGO",`Subí un logo PNG o JPG de hasta ${MAX_LOGO_MB} MB.`);
    if(input.logoStoragePath&&!/^bids\/[0-9a-f-]{36}\.(png|jpg)$/.test(input.logoStoragePath))throw new AuctionError("INVALID_LOGO","La referencia del logo no es válida.");
    const id=randomUUID(),nowIso=now.toISOString();
    if(leader)await sql`update public.bids set status='OUTBID',updated_at=${nowIso} where id=${leader.id} and status='LEADING'`;
    const [bid]=await sql<BidRow[]>`insert into public.bids(id,spot_id,bidder_company,bidder_email,bidder_logo,logo_storage_path,logo_mime_type,amount_cents,status,created_at,updated_at) values(${id},${spot.id},${company},${email},${input.logoBytes??null},${input.logoStoragePath??null},${input.logoMimeType},${input.amountCents},'LEADING',${nowIso},${nowIso}) returning *`;
    const startsAt=iso(spot.started_at)??nowIso,endsAt=iso(spot.ends_at)??new Date(now.getTime()+getAuctionDurationMs()).toISOString();
    await sql`update public.spots set status='ACTIVE',started_at=${startsAt},ends_at=${endsAt},leading_bid_id=${id},auction_round=case when status='AVAILABLE' then auction_round+1 else auction_round end where id=${spot.id}`;
    return mapBid(bid);
  });
}

export async function getPostgresAuctionState(now=new Date()):Promise<AuctionState>{
  const sql=getPostgres();
  await closeExpiredPostgresAuctions(now);
  const rows=await sql<Array<SpotRow&{bidder_company:string|null;logo_mime_type:string|null;logo_storage_path:string|null;amount_cents:number|string|null}>>`
    select s.*,b.bidder_company,b.logo_mime_type,b.logo_storage_path,b.amount_cents from public.spots s left join public.bids b on b.id=s.leading_bid_id order by s.sort_order`;
  const rankingRows=await sql<RankingRow[]>`
    select b.id,b.spot_id,b.bidder_company,b.logo_mime_type,b.logo_storage_path,b.amount_cents,b.status,b.created_at
    from public.bids b join public.spots s on s.id=b.spot_id
    where s.started_at is not null and b.created_at>=s.started_at and b.status in ('LEADING','OUTBID','RESERVED','CONTACTED')
    order by b.spot_id,b.amount_cents desc,b.created_at asc`;
  const rankings=new Map<string,PublicBid[]>();
  for(const row of rankingRows){const entries=rankings.get(row.spot_id)??[];entries.push({id:row.id,rank:entries.length+1,company:row.bidder_company,logoUrl:logoUrl(row.id,row.logo_mime_type,row.logo_storage_path),amountCents:amount(row.amount_cents),status:row.status,createdAt:iso(row.created_at)!});rankings.set(row.spot_id,entries);}
  const [metricRow]=await sql<Array<{active:number|string;reserved:number|string;available:number|string;total:number|string;value:number|string}>>`
    select count(*) filter(where status='ACTIVE')::int active,count(*) filter(where status='RESERVED')::int reserved,count(*) filter(where status='AVAILABLE')::int available,count(*)::int total,(select coalesce(sum(amount_cents),0) from public.bids where status in ('RESERVED','CONTACTED')) value from public.spots`;
  const spots=rows.map((row):PublicSpot=>({id:row.id,placement:row.placement,description:row.description,sizeLabel:row.size_label,tier:row.tier,tone:row.tone,status:row.status,sponsor:row.bidder_company??null,sponsorLogoUrl:row.leading_bid_id?logoUrl(row.leading_bid_id,row.logo_mime_type,row.logo_storage_path):null,startingAmountCents:amount(row.starting_amount_cents),currentBidCents:row.amount_cents===null?null:amount(row.amount_cents),minimumBidCents:row.amount_cents===null?amount(row.starting_amount_cents):amount(row.amount_cents)+amount(row.increment_amount_cents),startsAt:iso(row.started_at),endsAt:iso(row.ends_at),reservedAt:iso(row.reserved_at),auctionRound:row.auction_round,ranking:rankings.get(row.id)??[]}));
  return{generatedAt:now.toISOString(),metrics:{activeAuctions:amount(metricRow.active),reservedSpots:amount(metricRow.reserved),availableSpots:amount(metricRow.available),totalSpots:amount(metricRow.total),reservedValueCents:amount(metricRow.value)},spots};
}

export async function getPostgresTrackedBid(bidId:string,now=new Date()):Promise<TrackedBid|null>{
  const sql=getPostgres(),[row]=await sql<BidRow[]>`select * from public.bids where id=${bidId}`;
  if(!row)return null;
  const bid=mapBid(row),state=await getPostgresAuctionState(now),spot=state.spots.find(candidate=>candidate.id===bid.spotId);
  if(!spot)return null;
  const at=bid.email.indexOf("@"),maskedEmail=at>0?`${bid.email[0]}${"•".repeat(Math.min(5,Math.max(2,at-1)))}${bid.email.slice(at)}`:"•••";
  return{id:bid.id,spotId:bid.spotId,placement:spot.placement,company:bid.company,logoUrl:bid.logoUrl,maskedEmail,amountCents:bid.amountCents,status:bid.status,rank:spot.ranking.find(entry=>entry.id===bid.id)?.rank??null,spotStatus:spot.status,endsAt:spot.endsAt,reservedAt:spot.reservedAt,createdAt:bid.createdAt,contactedAt:bid.contactedAt};
}

export async function listPostgresContactRecords(now=new Date()):Promise<ContactRecord[]>{
  const sql=getPostgres(),state=await getPostgresAuctionState(now),spots=new Map(state.spots.map(spot=>[spot.id,spot]));
  const rows=await sql<BidRow[]>`select * from public.bids order by created_at desc`;
  return rows.map(row=>{const bid=mapBid(row),spot=spots.get(bid.spotId)!;return{bidId:bid.id,spotId:bid.spotId,placement:spot.placement,company:bid.company,email:bid.email,logoUrl:bid.logoUrl,amountCents:bid.amountCents,bidStatus:bid.status,spotStatus:spot.status,rank:spot.ranking.find(entry=>entry.id===bid.id)?.rank??null,createdAt:bid.createdAt,contactedAt:bid.contactedAt};});
}

export async function markPostgresContacted(bidId:string,now=new Date()){
  const nowIso=now.toISOString(),rows=await getPostgres()`update public.bids set status=case when status='RESERVED' then 'CONTACTED' else status end,contacted_at=${nowIso},updated_at=${nowIso} where id=${bidId} returning id`;
  return rows.length;
}

export async function getPostgresBidLogo(bidId:string){
  const [row]=await getPostgres()<Array<{bidder_logo:Uint8Array|null;logo_mime_type:"image/png"|"image/jpeg"|null}>>`select bidder_logo,logo_mime_type from public.bids where id=${bidId}`;
  return row;
}

function mapBid(row:BidRow):InternalBid{return{id:row.id,spotId:row.spot_id,company:row.bidder_company,email:row.bidder_email,logoUrl:logoUrl(row.id,row.logo_mime_type,row.logo_storage_path),amountCents:amount(row.amount_cents),status:row.status,createdAt:iso(row.created_at)!,contactedAt:iso(row.contacted_at)};}
