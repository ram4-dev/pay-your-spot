import "server-only";
import { formatArs } from "@/lib/auction/format";
import type { EmailProvider, WinnerEmail } from "./types";

export class ResendEmailProvider implements EmailProvider {
  readonly name="resend" as const;
  constructor(private readonly apiKey:string,private readonly from:string,private readonly fetcher:typeof fetch=fetch) {
    if (!apiKey || !from) throw new Error("Falta configurar RESEND_API_KEY y AUCTION_FROM_EMAIL.");
  }
  async sendWinnerPayment(input:WinnerEmail) {
    const safe=(value:string)=>value.replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]!));
    const deadline=new Intl.DateTimeFormat("es-AR",{dateStyle:"long",timeStyle:"short",timeZone:"America/Argentina/Buenos_Aires"}).format(new Date(input.paymentDueAt));
    const response=await this.fetcher("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${this.apiKey}`,"Content-Type":"application/json","Idempotency-Key":`winner-payment/${input.bidId}`},body:JSON.stringify({from:this.from,to:[input.to],subject:`Ganaste ${input.placement}: completá el pago`,text:`Hola ${input.company}. Ganaste ${input.placement} por ${formatArs(input.amountCents)}. Pagá antes del ${deadline}: ${input.checkoutUrl}`,html:`<h1>¡Ganaste ${safe(input.placement)}!</h1><p>Hola ${safe(input.company)}. Tu oferta de <strong>${formatArs(input.amountCents)}</strong> quedó primera.</p><p><a href="${safe(input.checkoutUrl)}">Completar pago con Mercado Pago</a></p><p>El enlace vence el ${safe(deadline)}. Si no se acredita el pago, el lugar vuelve a subasta.</p>`}),signal:AbortSignal.timeout(12_000)});
    const body=await response.json() as {id?:string;message?:string};
    if (!response.ok || !body.id) throw new Error(`No se pudo enviar el email: ${body.message??response.status}`);
    return {id:body.id};
  }
}
