import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { createAuctionDatabase,type AuctionDatabase } from "@/lib/auction/database";
import { closeExpiredAuctions,getInternalBid } from "@/lib/auction/service";
import type { ProviderPayment } from "@/lib/auction/types";
import type { EmailProvider } from "@/lib/email/types";
import { dispatchWinnerPaymentLinks,placeAuctionBid,settleProviderPayment } from "./orchestrator";
import type { CheckoutRequest,PaymentProvider } from "./types";

class RecordingProvider implements PaymentProvider { readonly name="test" as const; create=vi.fn(async(i:CheckoutRequest)=>({preferenceId:`pref-${i.bid.id}`,checkoutUrl:`https://pay.test/${i.bid.id}`}));refundPayment=vi.fn(async(id:string)=>({id:`refund-${id}`}));createCheckout(i:CheckoutRequest){return this.create(i)} async getPayment():Promise<ProviderPayment>{throw new Error("unused")} }
class RecordingEmail implements EmailProvider { readonly name="test" as const; send=vi.fn(async(i:{bidId:string})=>({id:`email-${i.bidId}`}));sendWinnerPayment(i:Parameters<EmailProvider["sendWinnerPayment"]>[0]){return this.send(i)} }

describe("winner payment orchestration",()=>{
  let db:AuctionDatabase,provider:RecordingProvider,email:RecordingEmail;const start=new Date("2026-08-29T15:00:00Z");
  beforeEach(()=>{process.env.ENABLE_TEST_PAYMENT_PROVIDER="1";process.env.AUCTION_DURATION_SECONDS="8";process.env.PAYMENT_WINDOW_SECONDS="20";db=createAuctionDatabase();provider=new RecordingProvider();email=new RecordingEmail();});
  afterEach(()=>{db.close();delete process.env.ENABLE_TEST_PAYMENT_PROVIDER;delete process.env.AUCTION_DURATION_SECONDS;delete process.env.PAYMENT_WINDOW_SECONDS;});
  it("creates and emails one checkout only after the auction closes",async()=>{
    const first=placeAuctionBid({spotId:"new-spot",company:"First",email:"first@example.com",amountCents:15_000_000},{database:db,now:start});
    const second=placeAuctionBid({spotId:"new-spot",company:"Winner",email:"winner@example.com",amountCents:15_500_000},{database:db,now:new Date(start.getTime()+1000)});
    expect(provider.create).not.toHaveBeenCalled();closeExpiredAuctions(db,new Date(start.getTime()+8000));
    await dispatchWinnerPaymentLinks("https://auction.test",{database:db,provider,emailProvider:email,now:new Date(start.getTime()+8000)});
    expect(provider.create).toHaveBeenCalledOnce();expect(email.send).toHaveBeenCalledWith(expect.objectContaining({bidId:second.bidId,to:"winner@example.com"}));
    await dispatchWinnerPaymentLinks("https://auction.test",{database:db,provider,emailProvider:email,now:new Date(start.getTime()+9000)});
    expect(provider.create).toHaveBeenCalledOnce();expect(email.send).toHaveBeenCalledOnce();expect(getInternalBid(db,first.bidId)?.status).toBe("OUTBID");
    await settleProviderPayment({id:"pay",status:"approved",externalReference:second.bidId,amountCents:15_500_000,currency:"ARS",payerEmail:"winner@example.com"},{database:db,provider,now:new Date(start.getTime()+10_000)});
    expect(getInternalBid(db,second.bidId)?.status).toBe("PAID");
  });
});
