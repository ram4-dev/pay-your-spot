import { defineConfig, devices } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const E2E_DATABASE_PATH = join(tmpdir(), "startup-day-auction-playwright.sqlite");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 35_000,
  expect: { timeout: 12_000 },
  globalSetup: "./e2e/global-setup.ts",
  outputDir: "test-results/artifacts",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3211",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3211",
    url: "http://127.0.0.1:3211/api/auction",
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      DATABASE_PATH: E2E_DATABASE_PATH,
      ENABLE_TEST_PAYMENT_PROVIDER: "1",
      AUCTION_DURATION_SECONDS: "5",
      AUCTION_SCHEDULER_INTERVAL_MS: "500",
      PUBLIC_APP_URL: "http://127.0.0.1:3211",
      ADMIN_ACCESS_TOKEN: "e2e-admin-token",
    },
  },
});
