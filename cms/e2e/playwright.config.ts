import { defineConfig, devices } from "@playwright/test";

/**
 * Valgfri browser-e2e (hovedsmoketesten er `npm run smoke`, som kun bruger fetch).
 *
 *   E2E_PORT=3000 npm run test:e2e                 # mod kørende server, byer på <by>.localhost:<port>
 *   E2E_BASE_URL=http://127.0.0.1:3100 ...          # alternativt host/port (by-host bygges alligevel af E2E_PORT)
 *
 * Chromium løser *.localhost til loopback, så ingen /etc/hosts er nødvendig. Mangler browseren (eller serveren),
 * springer testene over med forklaring i stedet for at fejle — se e2e/support.ts og docs/ops/CI.md.
 */
export default defineConfig({
  testDir: ".",
  outputDir: "./.output",
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
