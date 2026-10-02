/**
 * Beredskabstjek til /api/ready: database (SELECT 1) og Redis (PING, kun hvis REDIS_URL er sat), hver med timeout.
 * Resultatet caches kort, så en uptime-monitor eller et angreb på ruten ikke bliver til DB-belastning.
 * Svaret lækker ingen fejlbeskeder eller adresser — kun "ok" / "fail" / "skipped" pr. afhængighed.
 */
export type CheckState = "ok" | "fail" | "skipped";
export type Readiness = { ready: boolean; checks: { db: CheckState; redis: CheckState } };

export function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

export type ReadinessProbes = {
  db: () => Promise<unknown>;
  /** undefined = Redis er ikke konfigureret. */
  redis?: () => Promise<unknown>;
  timeoutMs?: number;
};

export async function runReadiness({ db, redis, timeoutMs = 2000 }: ReadinessProbes): Promise<Readiness> {
  const probe = async (fn: () => Promise<unknown>): Promise<CheckState> => {
    try {
      await withTimeout(Promise.resolve().then(fn), timeoutMs);
      return "ok";
    } catch {
      return "fail";
    }
  };
  const [dbState, redisState] = await Promise.all([probe(db), redis ? probe(redis) : Promise.resolve<CheckState>("skipped")]);
  return { ready: dbState === "ok" && redisState !== "fail", checks: { db: dbState, redis: redisState } };
}

// ── Standard-prober ────────────────────────────────────────────────────────

type PingClient = { ping(): Promise<string>; on(event: string, fn: () => void): unknown };
const globalForHealth = globalThis as unknown as { __healthRedis?: Promise<PingClient>; __readyCache?: { at: number; value: Promise<Readiness> } };

/** Egen lille klient til ping (lazyConnect, ingen offline-kø), så en død Redis svarer hurtigt med fejl. */
function healthRedis(url: string): Promise<PingClient> {
  return (globalForHealth.__healthRedis ??= import("ioredis").then((mod) => {
    const Redis = (mod as unknown as { default: new (u: string, o: Record<string, unknown>) => PingClient }).default;
    const client = new Redis(url, { lazyConnect: false, connectTimeout: 1500, maxRetriesPerRequest: 1, enableOfflineQueue: false, family: 0, retryStrategy: (n: number) => Math.min(n * 250, 3000) });
    client.on("error", () => undefined);
    // Vent kort på forbindelsen: uden offline-kø fejler en ping ellers på den allerførste kontrol efter opstart.
    return new Promise<PingClient>((resolve) => {
      const done = () => resolve(client);
      client.on("ready", done);
      setTimeout(done, 1500);
    });
  }));
}

const CACHE_MS = 2000;

export function getReadiness(): Promise<Readiness> {
  const cached = globalForHealth.__readyCache;
  const now = Date.now();
  if (cached && now - cached.at < CACHE_MS) return cached.value;
  const redisUrl = process.env.REDIS_URL?.trim();
  const value = runReadiness({
    db: async () => {
      const { db } = await import("./db");
      return db.$queryRaw`SELECT 1`;
    },
    redis: redisUrl ? async () => (await healthRedis(redisUrl)).ping() : undefined,
    timeoutMs: 2000,
  });
  globalForHealth.__readyCache = { at: now, value };
  return value;
}
