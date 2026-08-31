import "server-only";
import { timingSafeEqual } from "node:crypto";

export function authorizeAdmin(request:Request){
  const configured=process.env.ADMIN_ACCESS_TOKEN?.trim();
  if(!configured)return{ok:false as const,status:503,message:"Falta configurar ADMIN_ACCESS_TOKEN en el servidor."};
  const supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
  const left=Buffer.from(configured),right=Buffer.from(supplied);
  if(left.length!==right.length||!timingSafeEqual(left,right))return{ok:false as const,status:401,message:"Token de administración inválido."};
  return{ok:true as const};
}
