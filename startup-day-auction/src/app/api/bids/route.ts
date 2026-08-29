import { z } from "zod";

import { AuctionError } from "@/lib/auction/service";
import { createBidCheckout } from "@/lib/payments/orchestrator";
import { PaymentProviderError } from "@/lib/payments/types";

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

    const baseUrl = process.env.PUBLIC_APP_URL?.trim() || new URL(request.url).origin;
    const checkout = await createBidCheckout(
      {
        spotId: parsed.data.spotId,
        company: parsed.data.company,
        email: parsed.data.email,
        amountCents: parsed.data.amountArs * 100,
      },
      baseUrl,
    );
    return Response.json(checkout, { status: 201 });
  } catch (error) {
    if (error instanceof AuctionError || error instanceof PaymentProviderError) {
      const code =
        error instanceof AuctionError
          ? error.code
          : error.providerCode ?? "PAYMENT_ERROR";
      return Response.json(
        { error: { code, message: error.message } },
        { status: error.status },
      );
    }
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: "No pudimos iniciar el checkout." } },
      { status: 500 },
    );
  }
}
