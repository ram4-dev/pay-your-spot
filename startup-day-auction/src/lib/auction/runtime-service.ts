import { getAuctionDatabase } from "./database";
import { getPostgresAuctionState,getPostgresBidLogo,getPostgresTrackedBid,listPostgresContactRecords,markPostgresContacted,placePostgresBid } from "./postgres-service";
import { getAuctionState,getBidLogo,getTrackedBid,listContactRecords,markContacted,placeBid } from "./service";
import type { CreateBidInput } from "./types";

export { AuctionError } from "./service";

const usesPostgres=()=>Boolean(process.env.POSTGRES_URL);

export async function getRuntimeAuctionState(now=new Date()){return usesPostgres()?getPostgresAuctionState(now):getAuctionState(getAuctionDatabase(),now);}
export async function placeRuntimeBid(input:CreateBidInput,now=new Date()){return usesPostgres()?placePostgresBid(input,now):placeBid(getAuctionDatabase(),input,now);}
export async function getRuntimeTrackedBid(bidId:string,now=new Date()){return usesPostgres()?getPostgresTrackedBid(bidId,now):getTrackedBid(getAuctionDatabase(),bidId,now);}
export async function listRuntimeContactRecords(now=new Date()){return usesPostgres()?listPostgresContactRecords(now):listContactRecords(getAuctionDatabase(),now);}
export async function markRuntimeContacted(bidId:string,now=new Date()){return usesPostgres()?markPostgresContacted(bidId,now):markContacted(getAuctionDatabase(),bidId,now);}
export async function getRuntimeBidLogo(bidId:string){return usesPostgres()?getPostgresBidLogo(bidId):getBidLogo(getAuctionDatabase(),bidId);}
