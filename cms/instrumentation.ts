/**
 * Next.js instrumentation hook — kører én gang når serveren starter (ikke under `next build`).
 *
 * Holdes sammensat: hvert opstartstrin er en selvstændig funktion i `startupSteps`. Tilføj nye trin (fx eager
 * Redis-init, fejlovervågning) til listen i stedet for at skrive logik direkte i register().
 */

type StartupStep = { name: string; run: () => void | Promise<void> };

const startupSteps: StartupStep[] = [
  {
    // Fail fast: i produktion stopper manglende/ugyldige hemmeligheder opstarten (kun variabelnavne i beskeden).
    name: "env",
    run: async () => {
      const { assertEnv } = await import("./lib/env");
      assertEnv();
    },
  },
  {
    // Rate-limit-store: vælg Redis (REDIS_URL) ved opstart; lazyConnect + korte timeouts + circuit breaker (lib/ratelimit/redis-store.ts).
    name: "ratelimit-store",
    run: async () => {
      const { resolveRateLimitStore } = await import("./lib/ratelimit");
      await resolveRateLimitStore();
    },
  },
];

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // edge-runtime har hverken process.env-garanti eller Node-API'er
  if (process.env.NEXT_PHASE === "phase-production-build") return; // validér ved serverstart, ikke ved build
  for (const step of startupSteps) await step.run();
}
