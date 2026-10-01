import assert from "node:assert/strict";
import test from "node:test";
import { TURNSTILE_VERIFY_URL, isTurnstileEnabled, turnstileTokenFrom, verifyTurnstile } from "../lib/turnstile";
import { guardPublicAction } from "../lib/ratelimit/guard";
import { MemoryRateLimitStore, resetRateLimitStoreForTests, setRateLimitStore } from "../lib/ratelimit";

function fakeFetch(result: { success: boolean; codes?: string[]; status?: number } | Error) {
  const calls: Array<{ url: string; body: URLSearchParams }> = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body as URLSearchParams });
    if (result instanceof Error) throw result;
    return new Response(JSON.stringify({ success: result.success, "error-codes": result.codes ?? [] }), { status: result.status ?? 200 });
  };
  return { impl, calls };
}

test("turnstile: no-op uden TURNSTILE_SECRET_KEY (formularer virker som før)", async () => {
  const f = fakeFetch({ success: false });
  const prev = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  try {
    assert.deepEqual(await verifyTurnstile(undefined, "1.2.3.4", { fetchImpl: f.impl }), { ok: true, skipped: true });
    assert.equal(isTurnstileEnabled({} as NodeJS.ProcessEnv), false);
    assert.equal(f.calls.length, 0);
  } finally {
    if (prev !== undefined) process.env.TURNSTILE_SECRET_KEY = prev;
  }
});

test("turnstile: gyldigt token, ugyldigt token, manglende token", async () => {
  const ok = fakeFetch({ success: true });
  assert.deepEqual(await verifyTurnstile("tok", "203.0.113.5", { secret: "sec", fetchImpl: ok.impl }), { ok: true });
  assert.equal(ok.calls[0].url, TURNSTILE_VERIFY_URL);
  assert.equal(ok.calls[0].body.get("secret"), "sec");
  assert.equal(ok.calls[0].body.get("response"), "tok");
  assert.equal(ok.calls[0].body.get("remoteip"), "203.0.113.5");

  const bad = fakeFetch({ success: false, codes: ["invalid-input-response"] });
  const r = await verifyTurnstile("tok", "unknown", { secret: "sec", fetchImpl: bad.impl });
  assert.equal(r.ok, false);
  assert.equal(bad.calls[0].body.get("remoteip"), null, "ukendt/ /64-IP sendes ikke");

  const missing = fakeFetch({ success: true });
  for (const t of [undefined, "", null, 42, "x".repeat(3000)]) {
    assert.deepEqual(await verifyTurnstile(t, "1.2.3.4", { secret: "sec", fetchImpl: missing.impl }), { ok: false, reason: "missing-token" });
  }
  assert.equal(missing.calls.length, 0, "ingen netværkskald uden brugbart token");
});

test("turnstile: timeout/netværksfejl/HTTP-fejl fejler lukket som standard, åbent med failOpen", async () => {
  const slow = (): Promise<Response> => new Promise(() => undefined);
  assert.deepEqual(await verifyTurnstile("t", null, { secret: "s", fetchImpl: slow, timeoutMs: 20 }), { ok: false, reason: "unavailable" });
  assert.deepEqual(await verifyTurnstile("t", null, { secret: "s", fetchImpl: fakeFetch(new Error("net")).impl }), { ok: false, reason: "unavailable" });
  assert.deepEqual(await verifyTurnstile("t", null, { secret: "s", fetchImpl: fakeFetch({ success: true, status: 500 }).impl }), { ok: false, reason: "unavailable" });
  assert.deepEqual(await verifyTurnstile("t", null, { secret: "s", fetchImpl: fakeFetch(new Error("net")).impl, failOpen: true }), { ok: true, skipped: true });
});

test("turnstileTokenFrom læser FormData og almindelige objekter", () => {
  const fd = new FormData();
  fd.set("cf-turnstile-response", "abc");
  assert.equal(turnstileTokenFrom(fd), "abc");
  assert.equal(turnstileTokenFrom({ "cf-turnstile-response": "xyz" }), "xyz");
  assert.equal(turnstileTokenFrom({}), undefined);
  assert.equal(turnstileTokenFrom(null), undefined);
  assert.equal(turnstileTokenFrom("streng"), undefined);
});

test("guardPublicAction: honeypot og rate limit uændret; Turnstile kun når nøglen er sat", async () => {
  setRateLimitStore(new MemoryRateLimitStore());
  const prev = process.env.TURNSTILE_SECRET_KEY;
  const prevFetch = globalThis.fetch;
  try {
    delete process.env.TURNSTILE_SECRET_KEY;
    // uden nøgle: ingen captcha-krav (guard kaldes uden request-kontekst -> IP "unknown")
    assert.equal((await guardPublicAction({ action: "t-guard", limit: 2, honeypot: "" })).ok, true);
    assert.equal((await guardPublicAction({ action: "t-guard", limit: 2, honeypot: "bot" })).ok, false);

    process.env.TURNSTILE_SECRET_KEY = "sec";
    let verified = 0;
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      verified++;
      const body = init?.body as URLSearchParams;
      return new Response(JSON.stringify({ success: body.get("response") === "godt" }), { status: 200 });
    }) as typeof fetch;
    assert.equal((await guardPublicAction({ action: "t-guard2", limit: 5, captcha: { "cf-turnstile-response": "godt" } })).ok, true);
    const denied = await guardPublicAction({ action: "t-guard2", limit: 5, captcha: { "cf-turnstile-response": "daarligt" } });
    assert.equal(denied.ok, false);
    assert.match((denied as { error: string }).error, /menneske/);
    assert.equal((await guardPublicAction({ action: "t-guard2", limit: 5 })).ok, false, "manglende token afvises");
    assert.equal(verified, 2);
  } finally {
    globalThis.fetch = prevFetch;
    if (prev === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = prev;
    resetRateLimitStoreForTests();
  }
});
