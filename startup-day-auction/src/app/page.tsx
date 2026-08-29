import { connection } from "next/server";

import { AuctionExperience } from "@/components/auction-experience";
import { getAuctionDatabase } from "@/lib/auction/database";
import { getAuctionState } from "@/lib/auction/service";

export const runtime = "nodejs";

export default async function Home() {
  await connection();
  const initialState = getAuctionState(getAuctionDatabase());
  return <AuctionExperience initialState={initialState} />;
}
