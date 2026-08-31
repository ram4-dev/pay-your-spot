import { createClient } from "@supabase/supabase-js";

import { MAX_LOGO_BYTES } from "./logo";

export const LOGO_BUCKET="auction-logos";

function getAdminStorage(){
  const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)throw new Error("Supabase Storage is not configured");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}).storage.from(LOGO_BUCKET);
}

export async function createLogoUpload(path:string){
  const {data,error}=await getAdminStorage().createSignedUploadUrl(path);
  if(error)throw error;
  return data;
}

export async function validateUploadedLogo(path:string,mimeType:"image/png"|"image/jpeg"){
  const {data,error}=await getAdminStorage().download(path);
  if(error)throw error;
  const bytes=new Uint8Array(await data.arrayBuffer());
  if(bytes.byteLength===0||bytes.byteLength>MAX_LOGO_BYTES)return false;
  const png=mimeType==="image/png"&&bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value);
  const jpeg=mimeType==="image/jpeg"&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  return png||jpeg;
}

export async function removeUploadedLogo(path:string){await getAdminStorage().remove([path]);}

export function publicLogoUrl(path:string){
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL??process.env.SUPABASE_URL;
  return base?`${base}/storage/v1/object/public/${LOGO_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`:null;
}
