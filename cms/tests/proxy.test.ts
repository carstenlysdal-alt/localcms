import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { MemoryRateLimitStore, resetRateLimitStoreForTests, setRateLimitStore } from "../lib/ratelimit";
import { resetBanStateForTests } from "../lib/bot/ban";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const ENV_KEYS = ["NODE_ENV", "ORIGIN_SECRET", "CSP_REPORT_ONLY", "CACHE_PUBLIC_HTML", "TRUSTED_PROXY_HOPS", "TRUST_CLOUDFLARE", "TRUST_FORWARDED_HOST", "PAGE_RATE_LIMIT_PER_MIN"] as const;
const saved: Record<string, string | undefined> = {};
const env = process.env as Record<string, string | undefined>;

function req(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`https://naestvedlokalt.dk${path}`, {
    method: init.method ?? "GET",
    headers: { "user-agent": CHROME, "x-forwarded-for": "203.0.113.20", ...init.headers },
  });
}

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = env[k];
  env.NODE_ENV = "production";
  delete env.ORIGIN_SECRET;
  delete env.CSP_REPORT_ONLY;
  delete env.CACHE_PUBLIC_HTML;
  delete env.PAGE_RATE_LIMIT_PER_MIN;
  delete env.TRUST_CLOUDFLARE;
  delete env.TRUST_FORWARDED_HOST;
  delete env.TRUSTED_PROXY_HOPS;
  setRateLimitStore(new MemoryRateLimitStore());
  resetBanStateForTests();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete env[k];
    else env[k] = saved[k];
  }
  resetRateLimitStoreForTests();
  resetBanStateForTests();
});

test("proxy: sikkerhedsheadere + nonce-CSP på sider (produktion: håndhævet, HSTS via x-forwarded-proto)", async () => {
  const res = await proxy(req("/nyheder", { headers: { "x-forwarded-proto": "https" } }));
  const csp = res.headers.get("content-security-policy") ?? "";
  assert.match(csp, /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  assert.equal(res.headers.get("content-security-policy-report-only"), null);
  assert.match(res.headers.get("strict-transport-security") ?? "", /max-age=31536000/);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(res.headers.get("permissions-policy") ?? "", /camera=\(\)/);
  const other = await proxy(req("/nyheder"));
  assert.notEqual(other.headers.get("content-security-policy"), csp, "nonce er forskellig pr. forespørgsel");
  const forwarded = res.headers.get("x-middleware-request-x-nonce");
  assert.ok(forwarded && csp.includes(`'nonce-${forwarded}'`), "nonce videresendes til render-stien");
});

test("proxy: CSP_REPORT_ONLY=1 sender Report-Only i stedet; HSTS aldrig over http", async () => {
  env.CSP_REPORT_ONLY = "1";
  const res = await proxy(req("/", { headers: { "x-forwarded-proto": "http" } }));
  assert.equal(res.headers.get("content-security-policy"), null);
  assert.ok(res.headers.get("content-security-policy-report-only"));
  assert.equal(res.headers.get("strict-transport-security"), null);
});

test("proxy: origin-lås giver 403 uden hemmelighed, undtagen health/ready/cron", async () => {
  env.ORIGIN_SECRET = "hemmelig-streng-123456";
  assert.equal((await proxy(req("/"))).status, 403);
  assert.equal((await proxy(req("/api/articles"))).status, 403);
  assert.equal((await proxy(req("/", { headers: { "x-origin-secret": "forkert" } }))).status, 403);
  const ok = await proxy(req("/", { headers: { "x-origin-secret": "hemmelig-streng-123456" } }));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("x-middleware-request-x-origin-secret"), null, "hemmeligheden videresendes ikke til appen");
  for (const p of ["/api/health", "/api/ready", "/api/cron/frontpage-rank"]) assert.notEqual((await proxy(req(p))).status, 403, p);
  env.NODE_ENV = "development";
  assert.equal((await proxy(req("/"))).status, 200, "kun aktivt i produktion");
});

test("proxy: ondsindede stier får lille 404, og gentagelser eskalerer til ban", async () => {
  const first = await proxy(req("/wp-login.php"));
  assert.equal(first.status, 404);
  assert.equal(await first.text(), "Not found");
  for (let i = 0; i < 3; i++) await proxy(req("/.env"));
  const banned = await proxy(req("/nyheder"));
  assert.equal(banned.status, 429, "IP'en er bandlyst efter 4 strikes");
  assert.ok(banned.headers.get("retry-after"));
  assert.equal((await proxy(req("/nyheder", { headers: { "x-forwarded-for": "203.0.113.99" } }))).status, 200, "andre IP'er er upåvirkede");
  assert.notEqual((await proxy(req("/api/health"))).status, 429, "health er altid tilladt");
});

test("proxy: cache-header kun på anonym GET-HTML, aldrig med session eller på /redaktion og /api", async () => {
  const page = await proxy(req("/nyheder/min-artikel"));
  assert.equal(page.headers.get("cache-control"), "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  assert.equal(page.headers.get("vary"), "Host");
  assert.equal(page.headers.get("cache-tag"), "host:naestvedlokalt.dk");
  const withSession = await proxy(req("/nyheder", { headers: { cookie: "authjs.session-token=abc" } }));
  assert.equal(withSession.headers.get("cache-control"), null);
  assert.equal((await proxy(req("/api/articles"))).headers.get("cache-control"), null);
  assert.equal((await proxy(req("/nyheder", { method: "POST" }))).headers.get("cache-control"), null);
  const redir = await proxy(req("/redaktion/artikler"));
  assert.equal(redir.status, 307);
  assert.equal(redir.headers.get("cache-control"), "private, no-store");
  const authed = await proxy(req("/redaktion/artikler", { headers: { cookie: "authjs.session-token=abc" } }));
  assert.equal(authed.status, 200);
  assert.equal(authed.headers.get("cache-control"), "private, no-store");
  env.NODE_ENV = "development";
  assert.equal((await proxy(req("/nyheder"))).headers.get("cache-control"), null, "ikke i udvikling");
});

test("proxy: store POST-body på offentlige stier -> 413, redaktion og ingest undtaget", async () => {
  const big = { "content-length": String(5 * 1024 * 1024) };
  assert.equal((await proxy(req("/nyhedsbrev", { method: "POST", headers: big }))).status, 413);
  assert.equal((await proxy(req("/api/newsletter/subscribe", { method: "POST", headers: big }))).status, 413);
  assert.notEqual((await proxy(req("/redaktion/medier", { method: "POST", headers: { ...big, cookie: "authjs.session-token=a" } }))).status, 413);
  assert.notEqual((await proxy(req("/api/ingest/articles", { method: "POST", headers: big }))).status, 413);
  assert.notEqual((await proxy(req("/nyhedsbrev", { method: "POST", headers: { "content-length": "500" } }))).status, 413);
});

test("proxy: /soeg har længdeloft og IP-grænse; skrabere får strammere sidegrænse", async () => {
  assert.equal((await proxy(req(`/soeg?q=${"a".repeat(101)}`))).status, 400);
  let last = 200;
  for (let i = 0; i < 31; i++) last = (await proxy(req("/soeg?q=bil"))).status;
  assert.equal(last, 429);

  env.PAGE_RATE_LIMIT_PER_MIN = "100";
  let blockedAt = 0;
  for (let i = 1; i <= 30; i++) {
    const res = await proxy(req("/nyheder", { headers: { "user-agent": "python-requests/2.31", "x-forwarded-for": "203.0.113.55" } }));
    if (res.status === 429) {
      blockedAt = i;
      break;
    }
  }
  assert.ok(blockedAt > 0 && blockedAt <= 21, `skraber blokeret ved ${blockedAt}`);
});

test("proxy: gamle æøå-URL'er omdirigeres stadig (301) med sikkerhedsheadere", async () => {
  const res = await proxy(req("/nyheder/d%C3%B8gnrapport-test"));
  assert.equal(res.status, 301);
  assert.match(res.headers.get("location") ?? "", /doegnrapport-test/);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});

test("T5 P2-1: cache-nøgle og Vary følger Host — en klient-styret X-Forwarded-Host ignoreres som standard", async () => {
  const spoofed = await proxy(req("/", { headers: { host: "naestvedlokalt.dk", "x-forwarded-host": "slagelselokalt.dk" } }));
  assert.equal(spoofed.headers.get("cache-tag"), "host:naestvedlokalt.dk", "falsk X-Forwarded-Host må ikke vælge by");
  assert.equal(spoofed.headers.get("vary"), "Host");

  // Eksplicit tillid (TRUST_FORWARDED_HOST=1): højre element (betroet proxy) bruges, og Vary dækker begge headere.
  env.TRUST_FORWARDED_HOST = "1";
  const trusted = await proxy(req("/", { headers: { host: "internal.railway.app", "x-forwarded-host": "klient-styret.test, slagelselokalt.dk" } }));
  assert.equal(trusted.headers.get("cache-tag"), "host:slagelselokalt.dk");
  assert.equal(trusted.headers.get("vary"), "Host, X-Forwarded-Host");
});
