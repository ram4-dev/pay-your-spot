import { listRuntimeContactRecords,markRuntimeContacted } from "@/lib/auction/runtime-service";
import { authorizeAdmin } from "@/lib/admin/auth";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(request:Request){
  const authorization=authorizeAdmin(request);
  if(!authorization.ok)return Response.json({error:authorization.message},{status:authorization.status});
  return Response.json({generatedAt:new Date().toISOString(),contacts:await listRuntimeContactRecords()},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request:Request){
  const authorization=authorizeAdmin(request);
  if(!authorization.ok)return Response.json({error:authorization.message},{status:authorization.status});
  const body=await request.json().catch(()=>null) as {bidId?:string}|null;
  if(!body?.bidId||!/^[0-9a-f-]{36}$/i.test(body.bidId))return Response.json({error:"Oferta inválida"},{status:400});
  const changes=await markRuntimeContacted(body.bidId);
  return changes?Response.json({ok:true}):Response.json({error:"Oferta inexistente"},{status:404});
}
