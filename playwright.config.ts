import { defineConfig, devices } from "@playwright/test";

process.loadEnvFile(".env.local");

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: externalBaseURL ?? "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    {
      name: "tablet-chromium",
      testMatch: /reporting-closure\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
  ],
  ...(externalBaseURL
    ? {}
    : {
        webServer: {
          command: "pnpm dev --port 3001",
          url: "http://localhost:3001",
          // Never silently attach browser tests to an unrelated app on port 3000.
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }),
});
