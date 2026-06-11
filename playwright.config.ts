import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  use: {
    baseURL: process.env.BASE_URL || (process.env.CI ? "http://localhost:3000" : "http://localhost:5173"),
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["html", { open: "never" }]],
  outputDir: "e2e/test-results",
  webServer: {
    command: process.env.CI ? "bun run build && bun dist/server/server.js" : "bun run dev",
    port: process.env.CI ? 3000 : 5173,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
