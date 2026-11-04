import { defineConfig, devices } from "@playwright/test";

// Uses the Chrome already on the machine (channel "chrome"), so no browser download is needed.
// The dashboard is a static replay viewer, so the tests drive the real dev server with no backend.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 6_000 },
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: { command: "npm run dev", url: "http://localhost:5173", reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
});
