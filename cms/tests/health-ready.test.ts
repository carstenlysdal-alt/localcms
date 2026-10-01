import assert from "node:assert/strict";
import test from "node:test";
import { runReadiness, withTimeout } from "../lib/health";
import { GET as health } from "../app/api/health/route";

test("liveness svarer 200 no-store uden at røre DB", async () => {
  const res = health();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("readiness: DB ok, Redis ikke konfigureret", async () => {
  const r = await runReadiness({ db: async () => 1 });
  assert.deepEqual(r, { ready: true, checks: { db: "ok", redis: "skipped" } });
});

test("readiness: DB-fejl giver ikke-klar uden fejltekst", async () => {
  const r = await runReadiness({ db: async () => { throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=x"); } });
  assert.equal(r.ready, false);
  assert.deepEqual(r.checks, { db: "fail", redis: "skipped" });
  assert.ok(!JSON.stringify(r).includes("ECONNREFUSED"));
});

test("readiness: hængende DB afbrydes efter timeout", async () => {
  const t0 = Date.now();
  const r = await runReadiness({ db: () => new Promise(() => undefined), timeoutMs: 50 });
  assert.equal(r.ready, false);
  assert.ok(Date.now() - t0 < 1000);
});

test("readiness: Redis-fejl giver ikke-klar, Redis ok giver klar", async () => {
  assert.equal((await runReadiness({ db: async () => 1, redis: async () => { throw new Error("down"); } })).ready, false);
  assert.deepEqual(await runReadiness({ db: async () => 1, redis: async () => "PONG" }), { ready: true, checks: { db: "ok", redis: "ok" } });
});

test("withTimeout rydder timeren ved succes", async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 10_000), 7);
});
