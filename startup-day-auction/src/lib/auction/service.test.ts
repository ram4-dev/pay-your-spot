import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { DEFAULT_AUCTION_DURATION_MS } from "./constants";
import { createAuctionDatabase,type AuctionDatabase } from "./database";
import { AuctionError,closeExpiredAuctions,getAuctionState,getInternalBid,getTrackedBid,listContactRecords,markContacted,placeBid } from "./service";

const START=new Date("2026-08-29T15:00:00Z");
const input=(company="Prisma",amountCents=15_000_000)=>({spotId:"new-spot",company,email:`${company.toLowerCase()}@example.com`,amountCents});

describe("email reservation auction",()=>{
  let db:AuctionDatabase;
  beforeEach(()=>{delete process.env.AUCTION_DURATION_SECONDS;delete process.env.ENABLE_TEST_PAYMENT_PROVIDER;db=createAuctionDatabase();});
  afterEach(()=>db.close());

  it("starts exactly 72 hours and stores the bidder email",()=>{
    const bid=placeBid(db,input(),START),spot=getAuctionState(db,START).spots.find(s=>s.id==="new-spot")!;
    expect(bid.email).toBe("prisma@example.com");expect(spot.endsAt).toBe(new Date(START.getTime()+DEFAULT_AUCTION_DURATION_MS).toISOString());expect(spot.status).toBe("ACTIVE");
  });
  it("rejects an offer below the minimum",()=>{expect(()=>placeBid(db,input("Low",14_999_999),START)).toThrowError(AuctionError);});
  it("moves leadership and exposes the current ranking",()=>{
    const first=placeBid(db,input("First"),START),second=placeBid(db,input("Second",15_500_000),new Date(START.getTime()+1000));
    expect(getInternalBid(db,first.id)?.status).toBe("OUTBID");expect(getInternalBid(db,second.id)?.status).toBe("LEADING");
    expect(getAuctionState(db,START).spots.find(s=>s.id==="new-spot")?.ranking.map(b=>[b.company,b.rank])).toEqual([["Second",1],["First",2]]);
  });
  it("creates a permanent email reservation at closing with no expiry",()=>{
    const bid=placeBid(db,input("Winner"),START),closing=new Date(START.getTime()+DEFAULT_AUCTION_DURATION_MS);expect(closeExpiredAuctions(db,closing)).toBe(1);
    expect(getInternalBid(db,bid.id)?.status).toBe("RESERVED");expect(getAuctionState(db,new Date(closing.getTime()+365*86_400_000)).spots.find(s=>s.id==="new-spot")?.status).toBe("RESERVED");
  });
  it("persists contacts and reservation state after reopening SQLite",()=>{
    const directory=mkdtempSync(join(tmpdir(),"startup-day-reservation-")),filename=join(directory,"auction.sqlite"),firstDb=createAuctionDatabase(filename);
    const bid=placeBid(firstDb,input("Persistent"),START);closeExpiredAuctions(firstDb,new Date(START.getTime()+DEFAULT_AUCTION_DURATION_MS));firstDb.close();
    const reopened=createAuctionDatabase(filename),tracked=getTrackedBid(reopened,bid.id),contacts=listContactRecords(reopened);
    expect(tracked).toMatchObject({company:"Persistent",maskedEmail:"p•••••@example.com",status:"RESERVED"});expect(contacts[0]).toMatchObject({email:"persistent@example.com",bidStatus:"RESERVED"});
    expect(markContacted(reopened,bid.id)).toBe(1);expect(getInternalBid(reopened,bid.id)?.status).toBe("CONTACTED");reopened.close();rmSync(directory,{recursive:true,force:true});
  });
});
