import { z } from "zod";

import { AuctionError } from "@/lib/auction/service";
import { placeAuctionBid } from "@/lib/payments/orchestrator";

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

    const bid = placeAuctionBid(
      {
        spotId: parsed.data.spotId,
        company: parsed.data.company,
        email: parsed.data.email,
        amountCents: parsed.data.amountArs * 100,
      },
    );
    return Response.json(bid, { status: 201 });
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
