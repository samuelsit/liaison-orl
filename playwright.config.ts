import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3200";
const baseURL = `http://localhost:${port}`;

/**
 * Tests E2E du parcours complet, en mode démo (services simulés, données fictives).
 * Prérequis : `npm run build`. Les scénarios partagent une base : exécution en série.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: "tsx --tsconfig tsconfig.scripts.json scripts/e2e-server.ts",
    url: `${baseURL}/connexion`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: { E2E_PORT: port },
  },
});
