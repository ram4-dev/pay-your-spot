import "server-only";
import { getAuctionDatabase,type AuctionDatabase } from "@/lib/auction/database";
import { applyProviderPayment,attachCheckout,completeRefund,failPaymentLink,failRefund,getAuctionState,getInternalBid,listPaymentLinkCandidates,listRefundCandidates,markPaymentLinkSent,placeBid } from "@/lib/auction/service";
import type { CreateBidInput,ProviderPayment } from "@/lib/auction/types";
import { getEmailProvider } from "@/lib/email/provider";
import type { EmailProvider } from "@/lib/email/types";
import { getPaymentProvider } from "./provider";
import type { PaymentProvider } from "./types";

export function placeAuctionBid(input:CreateBidInput,dependencies?:{database?:AuctionDatabase;now?:Date}) {
  const database=dependencies?.database??getAuctionDatabase(), now=dependencies?.now??new Date();
  const bid=placeBid(database,input,now);
  const spot=getAuctionState(database,now).spots.find((s)=>s.id===bid.spotId)!;
  return {bidId:bid.id,status:bid.status,endsAt:spot.endsAt};
}

export async function dispatchWinnerPaymentLinks(baseUrl:string,dependencies?:{database?:AuctionDatabase;provider?:PaymentProvider;emailProvider?:EmailProvider;now?:Date}) {
  const database=dependencies?.database??getAuctionDatabase(), provider=dependencies?.provider??getPaymentProvider(), emailProvider=dependencies?.emailProvider??getEmailProvider(), now=dependencies?.now??new Date();
  const results:Array<{bidId:string;status:"sent"|"failed"}>=[];
  for (let bid of listPaymentLinkCandidates(database,now)) {
    try {
      const spot=getAuctionState(database,now).spots.find((s)=>s.id===bid.spotId);
      if (!spot || !bid.paymentDueAt) continue;
      if (!bid.checkoutUrl) {
        const checkout=await provider.createCheckout({bid,placement:spot.placement,baseUrl});
        bid=attachCheckout(database,bid.id,checkout.preferenceId,checkout.checkoutUrl,now)!;
      }
      await emailProvider.sendWinnerPayment({bidId:bid.id,to:bid.email,company:bid.company,placement:spot.placement,amountCents:bid.amountCents,checkoutUrl:bid.checkoutUrl!,paymentDueAt:bid.paymentDueAt!});
      markPaymentLinkSent(database,bid.id,now); results.push({bidId:bid.id,status:"sent"});
    } catch (error) {
      failPaymentLink(database,bid.id,error instanceof Error?error.message:"Error desconocido",now); results.push({bidId:bid.id,status:"failed"});
    }
  }
  return results;
}

export async function processPaymentById(paymentId:string) { const provider=getPaymentProvider(); return settleProviderPayment(await provider.getPayment(paymentId),{provider}); }
export async function settleProviderPayment(payment:ProviderPayment,dependencies?:{database?:AuctionDatabase;provider?:PaymentProvider;now?:Date}) {
  const database=dependencies?.database??getAuctionDatabase(),provider=dependencies?.provider??getPaymentProvider(),now=dependencies?.now??new Date();
  const result=applyProviderPayment(database,payment,now); const refunds=await drainRefundQueue({database,provider,now}); return {...result,refunds};
}
export async function approveTestBid(bidId:string) {
  const provider=getPaymentProvider(); if(provider.name!=="test") throw new Error("La confirmación manual sólo existe para pruebas.");
  const database=getAuctionDatabase(),bid=getInternalBid(database,bidId); if(!bid || bid.status!=="PAYMENT_PENDING") throw new Error("La oferta todavía no está habilitada para pagar.");
  return settleProviderPayment({id:`test-pay-${bid.id}`,status:"approved",externalReference:bid.id,amountCents:bid.amountCents,currency:"ARS",payerEmail:bid.email},{database,provider});
}
export async function drainRefundQueue(dependencies?:{database?:AuctionDatabase;provider?:PaymentProvider;now?:Date}) {
  const database=dependencies?.database??getAuctionDatabase(),provider=dependencies?.provider??getPaymentProvider(),now=dependencies?.now??new Date(); const results:Array<{bidId:string;status:"refunded"|"failed"}>=[];
  for(const bid of listRefundCandidates(database,now)){try{const refund=await provider.refundPayment(bid.paymentId!,`refund-${bid.id}`);completeRefund(database,bid.id,refund.id,now);results.push({bidId:bid.id,status:"refunded"});}catch(error){failRefund(database,bid.id,error instanceof Error?error.message:"Error desconocido",now);results.push({bidId:bid.id,status:"failed"});}}
  return results;
}
