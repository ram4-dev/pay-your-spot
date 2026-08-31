export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.POSTGRES_URL) {
    const { startAuctionScheduler } = await import("./lib/auction/scheduler");
    startAuctionScheduler();
  }
}
