import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Serial: a app E2E é um único servidor Next; logins paralelos em servidor "frio"
  // causavam flakiness (um login no-op antes da hidratação). Suíte pequena → serial é barato.
  workers: 1,
  // Per-test 90s: login em servidor "frio" + esperas de sessão de até 30s não podem
  // estourar o timeout do teste (default 30s). expect padrão 10s p/ asserções de UI.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts$/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
  ],
});
