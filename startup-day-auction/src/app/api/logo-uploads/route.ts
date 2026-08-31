import { randomUUID } from "node:crypto";
import { z } from "zod";

import { MAX_LOGO_BYTES,MAX_LOGO_MB } from "@/lib/auction/logo";
import { createLogoUpload } from "@/lib/auction/supabase-storage";

export const runtime="nodejs";

const schema=z.object({fileName:z.string().trim().min(1).max(180),mimeType:z.enum(["image/png","image/jpeg"]),size:z.number().int().positive().max(MAX_LOGO_BYTES)});

export async function POST(request:Request){
  if(!process.env.POSTGRES_URL)return Response.json({directUpload:false});
  const parsed=schema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return Response.json({error:{message:`Subí un logo PNG o JPG de hasta ${MAX_LOGO_MB} MB.`}},{status:400});
  const extension=parsed.data.mimeType==="image/png"?"png":"jpg",path=`bids/${randomUUID()}.${extension}`;
  try{const upload=await createLogoUpload(path);return Response.json({directUpload:true,path,token:upload.token});}
  catch{return Response.json({error:{message:"No pudimos preparar la carga del logo."}},{status:500});}
}
