import { closeExpiredAuctions } from "./service";
import { getAuctionDatabase } from "./database";
import { drainRefundQueue } from "../payments/orchestrator";

const globalForScheduler = globalThis as typeof globalThis & {
  startupDayAuctionScheduler?: ReturnType<typeof setInterval>;
};

export function startAuctionScheduler() {
  if (globalForScheduler.startupDayAuctionScheduler) return;

  const run = async () => {
    closeExpiredAuctions(getAuctionDatabase());
    try {
      await drainRefundQueue();
    } catch {
      // A later interval or webhook retries provider failures.
    }
  };

  const interval = setInterval(run, 30_000);
  interval.unref();
  globalForScheduler.startupDayAuctionScheduler = interval;
  void run();
}
