import { closeExpiredAuctions, reopenExpiredPaymentWindows } from "./service";
import { getAuctionDatabase } from "./database";
import { dispatchWinnerPaymentLinks, drainRefundQueue } from "../payments/orchestrator";

const globalForScheduler = globalThis as typeof globalThis & {
  startupDayAuctionScheduler?: ReturnType<typeof setInterval>;
};

export function startAuctionScheduler() {
  if (globalForScheduler.startupDayAuctionScheduler) return;

  const run = async () => {
    closeExpiredAuctions(getAuctionDatabase());
    reopenExpiredPaymentWindows(getAuctionDatabase());
    try {
      const baseUrl=process.env.PUBLIC_APP_URL?.trim();
      if (baseUrl) await dispatchWinnerPaymentLinks(baseUrl);
      await drainRefundQueue();
    } catch {
      // A later interval or webhook retries provider failures.
    }
  };

  const testInterval=Number(process.env.AUCTION_SCHEDULER_INTERVAL_MS);
  const intervalMs=process.env.ENABLE_TEST_PAYMENT_PROVIDER==="1" && Number.isFinite(testInterval) && testInterval>=250 ? testInterval : 30_000;
  const interval = setInterval(run, intervalMs);
  interval.unref();
  globalForScheduler.startupDayAuctionScheduler = interval;
  void run();
}
