import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tripwire suite. Currently guards the /draw map-reload regression
 * (dead map on return / refresh) that has escaped twice. Needs the dev server
 * + .env.local (Mapbox token) — Playwright starts it via webServer.
 *
 * Run: npm run test:e2e   (headed: npm run test:e2e -- --headed)
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // Headless Chromium needs a GL backend for Mapbox to actually paint.
    launchOptions: { args: ["--use-gl=angle", "--use-angle=swiftshader"] },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
