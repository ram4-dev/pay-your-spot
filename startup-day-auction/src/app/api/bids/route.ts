import { z } from "zod";

import { getAuctionDatabase } from "@/lib/auction/database";
import { AuctionError, getAuctionState, placeBid } from "@/lib/auction/service";

export const runtime = "nodejs";

const bidSchema = z.object({
  spotId: z.string().min(1).max(80),
  logoFileName: z.string().trim().min(1).max(180),
  logoDataUrl: z.string().max(2_700_000),
  email: z.email().max(254),
  amountArs: z.number().int().positive().max(100_000_000),
});

export async function POST(request: Request) {
  try {
    const parsed = bidSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: { code: "INVALID_BID", message: "Revisá los datos de la oferta." } },
        { status: 400 },
      );
    }
    const logo=parseLogo(parsed.data.logoDataUrl);
    if(!logo)return Response.json({error:{code:"INVALID_LOGO",message:"Subí un logo PNG o JPG de hasta 2 MB."}},{status:400});
    const company=brandLabel(parsed.data.logoFileName,parsed.data.email);

    const bid = placeBid(getAuctionDatabase(),
      {
        spotId: parsed.data.spotId,
        company,
        email: parsed.data.email,
        amountCents: parsed.data.amountArs * 100,
        logoBytes:logo.bytes,
        logoMimeType:logo.mimeType,
      },
    );
    const spot=getAuctionState(getAuctionDatabase()).spots.find(candidate=>candidate.id===bid.spotId)!;
    return Response.json({bidId:bid.id,status:bid.status,endsAt:spot.endsAt}, { status: 201 });
  } catch (error) {
    if (error instanceof AuctionError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "No pudimos registrar la oferta." } },
      { status: 500 },
    );
  }
}

function parseLogo(dataUrl:string){
  const match=/^data:(image\/png|image\/jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if(!match)return null;
  const bytes=Buffer.from(match[2],"base64"),mimeType=match[1] as "image/png"|"image/jpeg";
  if(bytes.byteLength===0||bytes.byteLength>2_000_000)return null;
  const png=mimeType==="image/png"&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=mimeType==="image/jpeg"&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  return png||jpeg?{bytes,mimeType}:null;
}

function brandLabel(fileName:string,email:string){
  const stem=fileName.replace(/\.(png|jpe?g)$/i,"").replace(/[_-]+/g," ").replace(/\s+/g," ").trim();
  const fallback=email.split("@")[0].replace(/[._-]+/g," ").trim();
  return(stem.length>=2?stem:fallback.length>=2?fallback:"Marca").slice(0,80);
}
