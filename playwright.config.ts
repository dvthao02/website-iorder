import { config as loadEnvironment } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnvironment({ quiet: true });

// Runs against already running apps (pnpm dev:backend / dev:cms / dev, or a
// Compose stack). Override the URLs with E2E_CMS_URL / E2E_WEB_URL.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_CMS_URL ?? "http://localhost:3001",
    locale: "vi-VN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsive.spec.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
});
