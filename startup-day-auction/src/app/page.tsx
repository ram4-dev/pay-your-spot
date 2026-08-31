import { connection } from "next/server";

import { AuctionExperience } from "@/components/auction-experience";
import { getRuntimeAuctionState } from "@/lib/auction/runtime-service";

export const runtime = "nodejs";

export default async function Home() {
  await connection();
  const initialState = await getRuntimeAuctionState();
  return <AuctionExperience initialState={initialState} />;
}
