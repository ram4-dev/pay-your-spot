import { getRuntimeTrackedBid } from "@/lib/auction/runtime-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(_request:Request,context:{params:Promise<{bidId:string}>}) {
  const {bidId}=await context.params;
  if(!/^[0-9a-f-]{36}$/i.test(bidId)) return Response.json({error:"Oferta inexistente"},{status:404});
  const bid=await getRuntimeTrackedBid(bidId);
  return bid?Response.json(bid,{headers:{"Cache-Control":"no-store"}}):Response.json({error:"Oferta inexistente"},{status:404});
}
