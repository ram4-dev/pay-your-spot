import { closeExpiredAuctions } from "./service";
import { getAuctionDatabase } from "./database";

const globalForScheduler = globalThis as typeof globalThis & {
  startupDayAuctionScheduler?: ReturnType<typeof setInterval>;
};

export function startAuctionScheduler() {
  if (globalForScheduler.startupDayAuctionScheduler) return;

  const run = () => {
    closeExpiredAuctions(getAuctionDatabase());
  };

  const testInterval=Number(process.env.AUCTION_SCHEDULER_INTERVAL_MS);
  const intervalMs=process.env.ENABLE_TEST_PAYMENT_PROVIDER==="1" && Number.isFinite(testInterval) && testInterval>=250 ? testInterval : 30_000;
  const interval = setInterval(run, intervalMs);
  interval.unref();
  globalForScheduler.startupDayAuctionScheduler = interval;
  run();
}
