import { defineConfig } from "@playwright/test";

// Drives the real app (seeded, deterministic) to prove the F -> A flow end to end, three times.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: { baseURL: "http://localhost:3100", trace: "on-first-retry" },
  webServer: {
    command: "PORT=3100 npm run dev",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
