import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { DEFAULT_AUCTION_DURATION_MS } from "./constants";
import { createAuctionDatabase,type AuctionDatabase } from "./database";
import { AuctionError,closeExpiredAuctions,getAuctionState,getInternalBid,getTrackedBid,listContactRecords,markContacted,placeBid } from "./service";

const START=new Date("2026-08-29T15:00:00Z");
const LOGO_BYTES=Uint8Array.from([137,80,78,71,13,10,26,10]);
const input=(company="Prisma",amountCents=500_000)=>({spotId:"new-spot",company,email:`${company.toLowerCase()}@example.com`,amountCents,logoBytes:LOGO_BYTES,logoMimeType:"image/png" as const});

describe("email reservation auction",()=>{
  let db:AuctionDatabase;
  beforeEach(()=>{delete process.env.AUCTION_DURATION_SECONDS;delete process.env.ENABLE_TEST_TIME_OVERRIDES;db=createAuctionDatabase();});
  afterEach(()=>db.close());

  it("starts exactly 72 hours and stores the bidder email",()=>{
    const bid=placeBid(db,input(),START),state=getAuctionState(db,START),spot=state.spots.find(s=>s.id==="new-spot")!;
    expect(bid).toMatchObject({email:"prisma@example.com",logoUrl:expect.stringMatching(/^\/api\/logos\//)});expect(spot.sponsorLogoUrl).toBe(bid.logoUrl);expect(state.spots.every(candidate=>candidate.startingAmountCents===500_000)).toBe(true);expect(spot.endsAt).toBe(new Date(START.getTime()+DEFAULT_AUCTION_DURATION_MS).toISOString());expect(spot.status).toBe("ACTIVE");
  });
  it("rejects an offer below the minimum",()=>{expect(()=>placeBid(db,input("Low",499_999),START)).toThrowError(AuctionError);});
  it("moves leadership and exposes the current ranking",()=>{
    const first=placeBid(db,input("First"),START),second=placeBid(db,input("Second",1_000_000),new Date(START.getTime()+1000));
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
  it("migrates a legacy payment-expired winner into a permanent reservation",()=>{
    const directory=mkdtempSync(join(tmpdir(),"startup-day-legacy-")),filename=join(directory,"auction.sqlite"),legacy=new DatabaseSync(filename);
    legacy.exec(`CREATE TABLE spots(id TEXT PRIMARY KEY,placement TEXT,description TEXT,size_label TEXT,tier TEXT,tone TEXT,starting_amount_cents INTEGER,increment_amount_cents INTEGER,status TEXT,started_at TEXT,ends_at TEXT,payment_due_at TEXT,locked_at TEXT,leading_bid_id TEXT,auction_round INTEGER);
      CREATE TABLE bids(id TEXT PRIMARY KEY,spot_id TEXT,bidder_company TEXT,bidder_email TEXT,amount_cents INTEGER,status TEXT,created_at TEXT,updated_at TEXT);
      INSERT INTO spots VALUES('new-spot','Módulo emergente','Entrada','0,6 m','Compacto','open',15000000,500000,'AVAILABLE','2026-08-29T15:00:00Z','2026-09-01T15:00:00Z',NULL,NULL,NULL,1);
      INSERT INTO bids VALUES('legacy-winner','new-spot','Legacy Winner','legacy@example.com',15500000,'PAYMENT_EXPIRED','2026-08-29T15:00:00Z','2026-09-02T15:00:00Z');`);legacy.close();
    const migrated=createAuctionDatabase(filename),spot=getAuctionState(migrated).spots.find(candidate=>candidate.id==="new-spot")!;
    expect(spot).toMatchObject({status:"RESERVED",sponsor:"Legacy Winner"});expect(getInternalBid(migrated,"legacy-winner")).toMatchObject({status:"RESERVED",email:"legacy@example.com"});
    migrated.close();rmSync(directory,{recursive:true,force:true});
  });
});
