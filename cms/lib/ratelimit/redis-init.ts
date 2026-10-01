import { RedisRateLimitStore, type RedisLike } from "./redis-store";

/**
 * Opretter Redis-storen fra REDIS_URL. Forbindelsen er doven (lazyConnect) og har korte grænser, så en død Redis
 * aldrig hænger forespørgsler:
 *   connectTimeout 1000 ms, commandTimeout 150 ms, maxRetriesPerRequest 1, genforbindelse med lille backoff.
 * `family: 0` er nødvendigt for Railways private netværk (IPv6) og skader ikke andre steder.
 */
export async function createRedisStoreFromEnv(url: string): Promise<RedisRateLimitStore | null> {
  const mod = await import("ioredis");
  const Redis = (mod as unknown as { default: new (url: string, options: Record<string, unknown>) => RedisLike & { on(event: string, fn: (...a: unknown[]) => void): unknown } }).default;
  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 1000,
    commandTimeout: 150,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: true,
    family: 0,
    retryStrategy: (times: number) => Math.min(times * 250, 3000),
  });
  // Uden en error-lytter kaster ioredis uhåndterede 'error'-events; fejl håndteres af circuit breakeren.
  client.on("error", () => undefined);
  return new RedisRateLimitStore(client);
}
