import { z } from "zod";

import { getAuctionDatabase } from "@/lib/auction/database";
import { AuctionError, getAuctionState, placeBid } from "@/lib/auction/service";

export const runtime = "nodejs";

const bidSchema = z.object({
  spotId: z.string().min(1).max(80),
  company: z.string().trim().min(2).max(80),
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

    const bid = placeBid(getAuctionDatabase(),
      {
        spotId: parsed.data.spotId,
        company: parsed.data.company,
        email: parsed.data.email,
        amountCents: parsed.data.amountArs * 100,
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
