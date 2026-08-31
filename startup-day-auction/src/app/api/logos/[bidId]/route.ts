import { getRuntimeBidLogo } from "@/lib/auction/runtime-service";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(_request:Request,context:{params:Promise<{bidId:string}>}){
  const {bidId}=await context.params;
  if(!/^[0-9a-f-]{36}$/i.test(bidId))return new Response(null,{status:404});
  const logo=await getRuntimeBidLogo(bidId);
  if(!logo?.bidder_logo||!logo.logo_mime_type)return new Response(null,{status:404});
  return new Response(Buffer.from(logo.bidder_logo),{headers:{"Content-Type":logo.logo_mime_type,"Cache-Control":"public, max-age=31536000, immutable","X-Content-Type-Options":"nosniff"}});
}
