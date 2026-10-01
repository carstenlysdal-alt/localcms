import { createHash } from "node:crypto";
import { CircuitBreaker } from "../resilience";
import { MemoryRateLimitStore, type RateLimitStore, type StoreHit } from "./index";

/**
 * Delt rate-limit-store oven på Redis (ioredis), med reserve-hukommelse og circuit breaker.
 *
 * Atomicitet: ét vindue = én nøgle. `MULTI: SET k 0 PX <vindue> NX; INCR k; PTTL k` er atomisk i Redis og kan
 * ikke efterlade en tæller uden udløb (modsat INCR + PEXPIRE i to trin). Lockout-tællere bruger de samme
 * primitiver (hit/peek/reset). Dedupe bruger `SET k 1 PX <vindue> NX`.
 *
 * Fejltolerance: korte timeouts sættes på klienten (se redis-init.ts). Efter `failureThreshold` fejl i træk åbner
 * kredsløbet i `openMs` (default 30 s), hvor al trafik går til proces-lokal hukommelse (`degraded: true`), og
 * der logges ÉN gang ved åbning og ÉN gang ved genoprettelse. rateLimit() afgør ud fra `degraded` om kaldet skal
 * fejle åbent (offentlige læsninger) eller lukket (login, indtag, token-actions).
 */

type PipelineResult = Array<[Error | null, unknown]> | null;

interface RedisPipeline {
  set(key: string, value: string | number, ...args: Array<string | number>): RedisPipeline;
  incr(key: string): RedisPipeline;
  pttl(key: string): RedisPipeline;
  get(key: string): RedisPipeline;
  exec(): Promise<PipelineResult>;
}

/** Minimal delmængde af ioredis' API (gør det trivielt at lave en fake i tests). */
export interface RedisLike {
  status?: string;
  connect?(): Promise<unknown>;
  once?(event: string, listener: (...args: unknown[]) => void): unknown;
  removeListener?(event: string, listener: (...args: unknown[]) => void): unknown;
  multi(): RedisPipeline;
  set(key: string, value: string | number, ...args: Array<string | number>): Promise<string | null>;
  pexpire(key: string, ms: number): Promise<number>;
  del(...keys: string[]): Promise<number>;
}

export type RedisStoreOptions = {
  prefix?: string;
  failureThreshold?: number;
  openMs?: number;
  connectTimeoutMs?: number;
  now?: () => number;
  onBreakerChange?: (name: string, state: string, detail?: string) => void;
  fallback?: MemoryRateLimitStore;
};

const MAX_KEY = 180;

export class RedisRateLimitStore implements RateLimitStore {
  readonly breaker: CircuitBreaker;
  readonly fallback: MemoryRateLimitStore;
  private readonly prefix: string;
  private readonly connectTimeoutMs: number;
  private connecting: Promise<void> | null = null;

  constructor(private readonly client: RedisLike, options: RedisStoreOptions = {}) {
    this.prefix = options.prefix ?? "rl:";
    this.connectTimeoutMs = options.connectTimeoutMs ?? 1000;
    this.fallback = options.fallback ?? new MemoryRateLimitStore();
    this.breaker = new CircuitBreaker({
      name: "redis-ratelimit",
      failureThreshold: options.failureThreshold ?? 3,
      openMs: options.openMs ?? 30_000,
      now: options.now,
      onStateChange:
        options.onBreakerChange ??
        ((name, state, detail) => {
          console.warn(
            state === "open"
              ? `[ratelimit] Redis utilgængelig – bruger hukommelse i op til 30 s${detail ? ` (${detail})` : ""}`
              : `[ratelimit] Redis genoprettet (${name})`,
          );
        }),
    });
  }

  isDegraded(): boolean {
    return this.breaker.isOpen();
  }

  private key(key: string): string {
    const k = key.length > MAX_KEY ? `${key.slice(0, 60)}#${createHash("sha1").update(key).digest("hex")}` : key;
    return this.prefix + k;
  }

  private async ensureReady(): Promise<void> {
    const status = this.client.status;
    if (status === undefined || status === "ready") return;
    if (!this.client.once) throw new Error("Redis er ikke klar");
    if (status === "wait" && this.client.connect && !this.connecting) {
      this.connecting = this.client.connect().then(
        () => undefined,
        () => undefined,
      ).finally(() => {
        this.connecting = null;
      });
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.client.removeListener?.("ready", onReady);
        reject(new Error("Redis-forbindelse timeout"));
      }, this.connectTimeoutMs);
      const onReady = () => {
        clearTimeout(timer);
        resolve();
      };
      this.client.once!("ready", onReady);
      if (this.client.status === "ready") onReady();
    });
  }

  /** Kør en Redis-operation bag kredsløbet. null = brug fallback. */
  private async run<T>(op: () => Promise<T>): Promise<{ value: T } | null> {
    if (!this.breaker.tryAcquire()) return null;
    try {
      await this.ensureReady();
      const value = await op();
      this.breaker.recordSuccess();
      return { value };
    } catch (error) {
      this.breaker.recordFailure(error);
      return null;
    }
  }

  async hit(key: string, windowMs: number, now: number): Promise<StoreHit> {
    const k = this.key(key);
    const res = await this.run(async () => {
      const out = await this.client.multi().set(k, 0, "PX", windowMs, "NX").incr(k).pttl(k).exec();
      if (!out || out.length < 3) throw new Error("MULTI afbrudt");
      for (const [err] of out) if (err) throw err;
      const count = Number(out[1][1]);
      let ttl = Number(out[2][1]);
      if (!Number.isFinite(count)) throw new Error("Ugyldig tæller");
      if (!(ttl > 0)) {
        // Nøgle uden udløb (fx efterladt af ældre kode): reparér, så den ikke lever evigt.
        await this.client.pexpire(k, windowMs);
        ttl = windowMs;
      }
      return { count, resetAt: now + ttl };
    });
    if (res) return res.value;
    return { ...(await this.fallback.hit(key, windowMs, now)), degraded: true };
  }

  async peek(key: string, now: number) {
    const k = this.key(key);
    const res = await this.run(async () => {
      const out = await this.client.multi().get(k).pttl(k).exec();
      if (!out || out.length < 2) throw new Error("MULTI afbrudt");
      for (const [err] of out) if (err) throw err;
      if (out[0][1] === null || out[0][1] === undefined) return null;
      const ttl = Number(out[1][1]);
      return { count: Number(out[0][1]), resetAt: now + (ttl > 0 ? ttl : 0) };
    });
    if (res) return res.value;
    return this.fallback.peek(key, now);
  }

  async reset(key: string): Promise<void> {
    this.fallback.reset(key);
    await this.run(() => this.client.del(this.key(key)));
  }

  async firstSeen(key: string, windowMs: number, now: number): Promise<boolean> {
    const res = await this.run(async () => (await this.client.set(this.key(key), "1", "PX", windowMs, "NX")) === "OK");
    if (res) return res.value;
    return (await this.fallback.hit(key, windowMs, now)).count === 1;
  }
}
