import { getRuntimeAuctionState } from "@/lib/auction/runtime-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getRuntimeAuctionState(), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
