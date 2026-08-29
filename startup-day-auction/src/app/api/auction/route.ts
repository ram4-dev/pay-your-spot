import { getAuctionDatabase } from "@/lib/auction/database";
import { getAuctionState } from "@/lib/auction/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getAuctionState(getAuctionDatabase()), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
