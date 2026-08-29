import { getAuctionDatabase } from "@/lib/auction/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (
    process.env.PAYMENT_PROVIDER !== "test" ||
    process.env.ENABLE_TEST_PAYMENT_PROVIDER !== "1"
  ) {
    return Response.json({ error: "Ruta inexistente" }, { status: 404 });
  }

  const spotId = new URL(request.url).searchParams.get("spotId");
  if (!spotId) return Response.json({ error: "spotId requerido" }, { status: 400 });

  const bids = getAuctionDatabase()
    .prepare(`
      SELECT bidder_company AS company, amount_cents AS amountCents, status,
        refund_id AS refundId, refund_reason AS refundReason
      FROM bids WHERE spot_id = ? ORDER BY created_at ASC
    `)
    .all(spotId);
  return Response.json({ bids }, { headers: { "Cache-Control": "no-store" } });
}
