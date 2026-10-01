import assert from "node:assert/strict";
import test from "node:test";
import { RedisRateLimitStore, type RedisLike } from "../lib/ratelimit/redis-store";
import {
  MemoryRateLimitStore,
  firstSeen,
  isLoginLocked,
  LOGIN_MAX_FAILURES,
  rateLimit,
  recordLoginFailure,
  resetRateLimitStoreForTests,
  setRateLimitStore,
} from "../lib/ratelimit";

/** Fake Redis med styrbart ur og mulighed for at simulere nedbrud. Understøtter præcis de kommandoer storen bruger. */
class FakeRedis implements RedisLike {
  status = "ready";
  down = false;
  calls = 0;
  now = 1_000_000;
  private data = new Map<string, { value: string; expiresAt: number | null }>();

  private live(key: string) {
    const e = this.data.get(key);
    if (e && e.expiresAt !== null && e.expiresAt <= this.now) {
      this.data.delete(key);
      return undefined;
    }
    return e;
  }
  private guard() {
    this.calls++;
    if (this.down) throw new Error("ECONNREFUSED");
  }
  private doSet(key: string, value: string | number, args: Array<string | number>) {
    let px: number | null = null;
    let nx = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "PX") px = Number(args[++i]);
      else if (args[i] === "NX") nx = true;
    }
    if (nx && this.live(key)) return null;
    this.data.set(key, { value: String(value), expiresAt: px === null ? null : this.now + px });
    return "OK";
  }
  private doIncr(key: string) {
    const e = this.live(key);
    const next = (e ? Number(e.value) : 0) + 1;
    this.data.set(key, { value: String(next), expiresAt: e ? e.expiresAt : null });
    return next;
  }
  private doPttl(key: string) {
    const e = this.live(key);
    if (!e) return -2;
    return e.expiresAt === null ? -1 : e.expiresAt - this.now;
  }
  multi() {
    const ops: Array<() => unknown> = [];
    const chain = {
      set: (key: string, value: string | number, ...args: Array<string | number>) => (ops.push(() => this.doSet(key, value, args)), chain),
      incr: (key: string) => (ops.push(() => this.doIncr(key)), chain),
      pttl: (key: string) => (ops.push(() => this.doPttl(key)), chain),
      get: (key: string) => (ops.push(() => this.live(key)?.value ?? null), chain),
      exec: async () => {
        this.guard();
        return ops.map((op) => [null, op()] as [Error | null, unknown]);
      },
    };
    return chain;
  }
  async set(key: string, value: string | number, ...args: Array<string | number>) {
    this.guard();
    return this.doSet(key, value, args);
  }
  async pexpire(key: string, ms: number) {
    this.guard();
    const e = this.live(key);
    if (!e) return 0;
    e.expiresAt = this.now + ms;
    return 1;
  }
  async del(...keys: string[]) {
    this.guard();
    let n = 0;
    for (const k of keys) if (this.data.delete(k)) n++;
    return n;
  }
  /** Test-hjælper: læg en nøgle uden udløb (efterladt tæller). */
  plant(key: string, value: string) {
    this.data.set(key, { value, expiresAt: null });
  }
  ttl(key: string) {
    return this.doPttl(key);
  }
}

function make(opts: { openMs?: number } = {}) {
  const redis = new FakeRedis();
  const events: string[] = [];
  const store = new RedisRateLimitStore(redis, {
    failureThreshold: 3,
    openMs: opts.openMs ?? 30_000,
    now: () => redis.now,
    onBreakerChange: (_n, state) => events.push(state),
  });
  return { redis, store, events };
}

test("redis-store: atomisk vindue — tæller op, TTL sættes ved første hit, nulstilles efter udløb", async () => {
  const { redis, store } = make();
  const a = await store.hit("k", 60_000, redis.now);
  const b = await store.hit("k", 60_000, redis.now);
  const c = await store.hit("k", 60_000, redis.now);
  assert.deepEqual([a.count, b.count, c.count], [1, 2, 3]);
  assert.equal(a.degraded, undefined);
  assert.equal(redis.ttl("rl:k"), 60_000);
  redis.now += 59_000;
  assert.equal((await store.hit("k", 60_000, redis.now)).count, 4);
  redis.now += 2_000;
  assert.equal((await store.hit("k", 60_000, redis.now)).count, 1, "nyt vindue");
});

test("redis-store: nøgle uden udløb repareres (ingen evig tæller)", async () => {
  const { redis, store } = make();
  redis.plant("rl:stuck", "99");
  const r = await store.hit("stuck", 10_000, redis.now);
  assert.equal(r.count, 100);
  assert.equal(redis.ttl("rl:stuck"), 10_000);
});

test("redis-store: peek og reset (lockout-tællere)", async () => {
  const { redis, store } = make();
  assert.equal(await store.peek("login-fail:email:a", redis.now), null);
  await store.hit("login-fail:email:a", 900_000, redis.now);
  await store.hit("login-fail:email:a", 900_000, redis.now);
  const peek = await store.peek("login-fail:email:a", redis.now);
  assert.equal(peek?.count, 2);
  assert.equal(peek?.resetAt, redis.now + 900_000);
  await store.reset("login-fail:email:a");
  assert.equal(await store.peek("login-fail:email:a", redis.now), null);
});

test("redis-store: dedupe via SET NX PX", async () => {
  const { redis, store } = make();
  assert.equal(await store.firstSeen("seen:x:v1", 1000, redis.now), true);
  assert.equal(await store.firstSeen("seen:x:v1", 1000, redis.now), false);
  assert.equal(await store.firstSeen("seen:x:v2", 1000, redis.now), true);
  redis.now += 1001;
  assert.equal(await store.firstSeen("seen:x:v1", 1000, redis.now), true);
});

test("redis-store: lange nøgler hashes (bevarer unikhed, begrænser længde)", async () => {
  const { redis, store } = make();
  const long1 = `k:${"a".repeat(500)}1`;
  const long2 = `k:${"a".repeat(500)}2`;
  assert.equal((await store.hit(long1, 1000, redis.now)).count, 1);
  assert.equal((await store.hit(long2, 1000, redis.now)).count, 1);
  assert.equal((await store.hit(long1, 1000, redis.now)).count, 2);
});

test("circuit breaker: efter 3 fejl bruges hukommelse (degraded) i 30 s, logges én gang, og Redis genoprettes", async () => {
  const { redis, store, events } = make();
  assert.equal((await store.hit("k", 60_000, redis.now)).degraded, undefined);
  redis.down = true;
  const r1 = await store.hit("k", 60_000, redis.now);
  const r2 = await store.hit("k", 60_000, redis.now);
  const r3 = await store.hit("k", 60_000, redis.now);
  assert.ok(r1.degraded && r2.degraded && r3.degraded);
  assert.equal(store.isDegraded(), true);
  assert.deepEqual(events, ["open"], "logger kun ved åbning");

  const callsBefore = redis.calls;
  for (let i = 0; i < 5; i++) assert.equal((await store.hit("k", 60_000, redis.now)).degraded, true);
  assert.equal(redis.calls, callsBefore, "ingen Redis-kald mens kredsløbet er åbent");
  // Fallback tæller lokalt og fortsætter
  assert.ok((await store.hit("k", 60_000, redis.now)).count > 3);

  // Efter 30 s: prøvekald; er Redis oppe igen lukker kredsløbet
  redis.down = false;
  redis.now += 31_000;
  const back = await store.hit("k", 60_000, redis.now);
  assert.equal(back.degraded, undefined);
  assert.equal(store.isDegraded(), false);
  assert.deepEqual(events, ["open", "closed"]);
});

test("circuit breaker: mislykket prøvekald åbner igen uden ny logning af 'open'-spam", async () => {
  const { redis, store, events } = make();
  redis.down = true;
  for (let i = 0; i < 3; i++) await store.hit("k", 1000, redis.now);
  redis.now += 31_000;
  const r = await store.hit("k", 1000, redis.now); // half-open prøve fejler
  assert.equal(r.degraded, true);
  assert.equal(store.isDegraded(), true);
  assert.equal(events.filter((e) => e === "open").length, 1);
});

test("fail-open vs fail-closed når Redis er nede", async () => {
  const { redis, store } = make();
  setRateLimitStore(store);
  try {
    redis.down = true;
    // Åben (standard): proces-lokal tæller, trafikken går igennem og grænsen gælder stadig lokalt
    const open = [];
    for (let i = 0; i < 4; i++) open.push(await rateLimit({ bucket: "pub", key: "ip", limit: 3, windowMs: 60_000, now: redis.now }));
    assert.deepEqual(open.map((r) => r.ok), [true, true, true, false]);
    // Lukket: afvist med Retry-After og degraded-markering
    const closed = await rateLimit({ bucket: "login", key: "ip", limit: 100, windowMs: 60_000, now: redis.now, failMode: "closed" });
    assert.equal(closed.ok, false);
    assert.equal(closed.degraded, true);
    assert.equal(closed.retryAfterSec, 30);
    // Login-lockout fejler lukket
    assert.equal(await isLoginLocked("a@b.dk", "1.2.3.4", redis.now), true);
    // firstSeen fejler åbent (dedupe kun pr. instans): første gang true, derefter lokalt false
    assert.equal(await firstSeen("view", "v", 1000, redis.now), true);
    assert.equal(await firstSeen("view", "v", 1000, redis.now), false);
  } finally {
    resetRateLimitStoreForTests();
  }
});

test("RATELIMIT_FAIL_CLOSED=0 nedgraderer lukket til lokal håndhævelse", async () => {
  const { redis, store } = make();
  setRateLimitStore(store);
  const prev = process.env.RATELIMIT_FAIL_CLOSED;
  process.env.RATELIMIT_FAIL_CLOSED = "0";
  try {
    redis.down = true;
    const r = await rateLimit({ bucket: "login", key: "ip", limit: 100, windowMs: 60_000, now: redis.now, failMode: "closed" });
    assert.equal(r.ok, true);
    assert.equal(await isLoginLocked("a@b.dk", "1.2.3.4", redis.now), false);
  } finally {
    if (prev === undefined) delete process.env.RATELIMIT_FAIL_CLOSED;
    else process.env.RATELIMIT_FAIL_CLOSED = prev;
    resetRateLimitStoreForTests();
  }
});

test("login-lockout over Redis-storen (delt mellem 'instanser')", async () => {
  const redis = new FakeRedis();
  const a = new RedisRateLimitStore(redis, { now: () => redis.now });
  const b = new RedisRateLimitStore(redis, { now: () => redis.now });
  setRateLimitStore(a);
  try {
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) await recordLoginFailure("x@y.dk", "9.9.9.9", redis.now);
    setRateLimitStore(b); // en anden instans ser den samme tæller
    assert.equal(await isLoginLocked("x@y.dk", "8.8.8.8", redis.now), true);
    assert.equal(await isLoginLocked("andre@y.dk", "8.8.8.8", redis.now), false);
  } finally {
    resetRateLimitStoreForTests();
  }
});

test("klient der ikke er klar (status wait) forsøger connect og falder tilbage ved timeout", async () => {
  const redis = new FakeRedis();
  redis.status = "wait";
  let connectCalls = 0;
  (redis as unknown as { connect: () => Promise<void> }).connect = async () => {
    connectCalls++;
  };
  (redis as unknown as { once: () => void }).once = () => undefined; // sender aldrig 'ready'
  const store = new RedisRateLimitStore(redis, { connectTimeoutMs: 20, now: () => redis.now });
  const r = await store.hit("k", 1000, redis.now);
  assert.equal(r.degraded, true);
  assert.equal(connectCalls, 1);
  assert.ok(new MemoryRateLimitStore());
});
