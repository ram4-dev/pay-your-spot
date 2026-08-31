import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { mkdtempSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_AUCTION_DURATION_MS,DEFAULT_PAYMENT_WINDOW_MS } from "./constants";
import { createAuctionDatabase,type AuctionDatabase } from "./database";
import { applyProviderPayment,closeExpiredAuctions,getAuctionState,getInternalBid,getTrackedBid,placeBid,reopenExpiredPaymentWindows } from "./service";

const START=new Date("2026-08-29T15:00:00.000Z");
const input=(company="Prisma",amountCents=15_000_000)=>({spotId:"new-spot",company,email:`${company.toLowerCase()}@example.com`,amountCents});
const approved=(id:string,amountCents:number)=>({id:`pay-${id}`,status:"approved",externalReference:id,amountCents,currency:"ARS",payerEmail:"buyer@example.com"});

describe("deferred-payment auction",()=>{
  let db:AuctionDatabase;
  beforeEach(()=>{delete process.env.AUCTION_DURATION_SECONDS;delete process.env.PAYMENT_WINDOW_SECONDS;delete process.env.ENABLE_TEST_PAYMENT_PROVIDER;db=createAuctionDatabase();});
  afterEach(()=>db.close());

  it("starts 72 hours on the first bid without charging it",()=>{
    const bid=placeBid(db,input(),START),spot=getAuctionState(db,START).spots.find(s=>s.id==="new-spot")!;
    expect(bid.status).toBe("LEADING"); expect(spot.startsAt).toBe(START.toISOString());
    expect(spot.endsAt).toBe(new Date(START.getTime()+DEFAULT_AUCTION_DURATION_MS).toISOString());
    expect(getAuctionState(db,START).metrics.totalRaisedCents).toBe(0);
  });

  it("replaces leadership atomically without payments or refunds",()=>{
    const first=placeBid(db,input("First"),START);
    const second=placeBid(db,input("Second",15_500_000),new Date(START.getTime()+1000));
    expect(getInternalBid(db,first.id)?.status).toBe("OUTBID"); expect(getInternalBid(db,second.id)?.status).toBe("LEADING");
    expect(getAuctionState(db).spots.find(s=>s.id==="new-spot")?.sponsor).toBe("Second");
    expect(getAuctionState(db).spots.find(s=>s.id==="new-spot")?.ranking.map(b=>[b.company,b.rank])).toEqual([["Second",1],["First",2]]);
  });

  it("moves the winner into an exact 24-hour payment window",()=>{
    const bid=placeBid(db,input(),START),closing=new Date(START.getTime()+DEFAULT_AUCTION_DURATION_MS);
    expect(closeExpiredAuctions(db,closing)).toBe(1);
    const spot=getAuctionState(db,closing).spots.find(s=>s.id==="new-spot")!;
    expect(spot.status).toBe("AWAITING_PAYMENT"); expect(getInternalBid(db,bid.id)?.status).toBe("PAYMENT_PENDING");
    expect(spot.paymentDueAt).toBe(new Date(closing.getTime()+DEFAULT_PAYMENT_WINDOW_MS).toISOString());
  });

  it("locks and counts only a valid winner payment",()=>{
    const bid=placeBid(db,input(),START),closing=new Date(START.getTime()+DEFAULT_AUCTION_DURATION_MS);closeExpiredAuctions(db,closing);
    expect(applyProviderPayment(db,approved(bid.id,bid.amountCents),new Date(closing.getTime()+1000)).outcome).toBe("paid");
    const state=getAuctionState(db);expect(state.metrics.lockedSpots).toBe(1);expect(state.metrics.totalRaisedCents).toBe(bid.amountCents);
  });

  it("reopens after an unpaid window and starts a fresh round",()=>{
    const first=placeBid(db,input("First"),START),closing=new Date(START.getTime()+DEFAULT_AUCTION_DURATION_MS);closeExpiredAuctions(db,closing);
    const expiry=new Date(closing.getTime()+DEFAULT_PAYMENT_WINDOW_MS);expect(reopenExpiredPaymentWindows(db,expiry)).toBe(1);
    expect(getInternalBid(db,first.id)?.status).toBe("PAYMENT_EXPIRED");
    const next=placeBid(db,input("Next"),new Date(expiry.getTime()+1)),spot=getAuctionState(db).spots.find(s=>s.id==="new-spot")!;
    expect(next.status).toBe("LEADING");expect(spot.auctionRound).toBe(2);expect(spot.endsAt).toBe(new Date(expiry.getTime()+1+DEFAULT_AUCTION_DURATION_MS).toISOString());
  });

  it("queues a late payment for refund",()=>{
    const bid=placeBid(db,input(),START),closing=new Date(START.getTime()+DEFAULT_AUCTION_DURATION_MS);closeExpiredAuctions(db,closing);
    const late=new Date(closing.getTime()+DEFAULT_PAYMENT_WINDOW_MS+1),result=applyProviderPayment(db,approved(bid.id,bid.amountCents),late);
    expect(result.outcome).toBe("refund-required");expect(getInternalBid(db,bid.id)?.refundReason).toBe("PAYMENT_WINDOW_EXPIRED");
  });

  it("persists the bid, ranking, and email relationship after reopening SQLite",()=>{
    const directory=mkdtempSync(join(tmpdir(),"startup-day-state-")),filename=join(directory,"auction.sqlite");
    const firstDatabase=createAuctionDatabase(filename);
    const bid=placeBid(firstDatabase,input("Persistent"),START); firstDatabase.close();
    const reopened=createAuctionDatabase(filename);
    const tracked=getTrackedBid(reopened,bid.id,START),spot=getAuctionState(reopened,START).spots.find(candidate=>candidate.id==="new-spot")!;
    expect(tracked).toMatchObject({company:"Persistent",maskedEmail:"p•••••@example.com",status:"LEADING",rank:1});
    expect(spot.ranking).toEqual([expect.objectContaining({company:"Persistent",rank:1})]);
    reopened.close(); rmSync(directory,{recursive:true,force:true});
  });
});
