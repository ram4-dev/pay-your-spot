export type WinnerEmail = { bidId:string; to:string; company:string; placement:string; amountCents:number; checkoutUrl:string; paymentDueAt:string };
export interface EmailProvider { readonly name:"resend"|"test"; sendWinnerPayment(input:WinnerEmail):Promise<{id:string}> }
