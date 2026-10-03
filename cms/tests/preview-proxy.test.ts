import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { NextRequest } from "next/server";
import { GET as switchRoute } from "../app/api/site/switch/route";
import { proxy } from "../proxy";
import { resetBanStateForTests } from "../lib/bot/ban";
import { MemoryRateLimitStore, resetRateLimitStoreForTests, setRateLimitStore } from "../lib/ratelimit";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const RAILWAY = "lysdalcms-production.up.railway.app";
const ENV_KEYS = ["NODE_ENV", "ORIGIN_SECRET", "CSP_REPORT_ONLY", "CACHE_PUBLIC_HTML", "TRUSTED_PROXY_HOPS", "TRUST_CLOUDFLARE", "TRUST_FORWARDED_HOST", "PAGE_RATE_LIMIT_PER_MIN", "PREVIEW_HOSTS"] as const;
const saved: Record<string, string | undefined> = {};
const env = process.env as Record<string, string | undefined>;

function req(host: string, path: string, init: { method?: string; headers?: Record<string, string>; proto?: string } = {}) {
  return new NextRequest(`${init.proto ?? "https"}://${host}${path}`, {
    method: init.method ?? "GET",
    headers: { "user-agent": CHROME, "x-forwarded-for": "203.0.113.30", "x-forwarded-proto": init.proto ?? "https", ...init.headers },
  });
}

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = env[k];
  env.NODE_ENV = "production";
  env.PREVIEW_HOSTS = RAILWAY;
  env.CACHE_PUBLIC_HTML = "1"; // cache slået til: preview-værter må ALLIGEVEL aldrig cache'es
  for (const k of ["ORIGIN_SECRET", "CSP_REPORT_ONLY", "PAGE_RATE_LIMIT_PER_MIN", "TRUST_CLOUDFLARE", "TRUST_FORWARDED_HOST", "TRUSTED_PROXY_HOPS"]) delete env[k];
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

const setCookie = (res: Response) => res.headers.get("set-cookie") ?? "";

test("?by=<gyldig nøgle> på preview-vært: sætter lk_by og 303-omdirigerer til samme URL uden parameteren", async () => {
  const res = await proxy(req(RAILWAY, "/nyheder?by=naestved&side=2"));
  assert.equal(res.status, 303);
  const loc = new URL(res.headers.get("location") ?? "");
  assert.equal(loc.pathname + loc.search, "/nyheder?side=2", "kun by fjernes");
  assert.equal(loc.host, RAILWAY, "samme vært (aldrig en anden vært)");
  const cookie = setCookie(res);
  assert.match(cookie, /^lk_by=naestved;/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /Secure/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Path=\//i);
  assert.match(cookie, /Max-Age=2592000/i, "30 dage");
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.match(res.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.match(res.headers.get("x-robots-tag") ?? "", /nofollow/);
  // forsiden uden øvrige parametre
  const home = await proxy(req(RAILWAY, "/?by=KOEGE"));
  assert.equal(home.status, 303);
  const homeLoc = new URL(home.headers.get("location") ?? "");
  assert.equal(homeLoc.pathname + homeLoc.search, "/");
  assert.equal(homeLoc.host, RAILWAY);
  assert.match(setCookie(home), /^lk_by=koege;/);
});

test("alle seks nøgler accepteres; cookien er Secure kun over https", async () => {
  for (const key of ["slagelse", "naestved", "holbaek", "koege", "roskilde", "ringsted"]) {
    const res = await proxy(req(RAILWAY, `/?by=${key}`));
    assert.match(setCookie(res), new RegExp(`^lk_by=${key};`));
  }
  const http = await proxy(req(RAILWAY, "/?by=holbaek", { proto: "http" }));
  assert.equal(http.status, 303);
  assert.doesNotMatch(setCookie(http), /Secure/i);
});

test("ugyldig/ukendt ?by= ignoreres: ingen cookie, ingen omdirigering", async () => {
  for (const bad of ["", "ukendt", "naestvedlokalt.dk", "n%C3%A6stved", "..%2Fredaktion", "naestved%0d%0aSet-Cookie:x=1", "x".repeat(200)]) {
    const res = await proxy(req(RAILWAY, `/nyheder?by=${bad}`));
    assert.notEqual(res.status, 303, bad);
    assert.equal(setCookie(res), "", bad);
  }
});

test("bypass-forsøg: protokol-relativ sti giver aldrig en åben omdirigering", async () => {
  const res = await proxy(req(RAILWAY, "//evil.example/x?by=naestved"));
  assert.equal(res.status, 303);
  const location = res.headers.get("location") ?? "";
  assert.equal(new URL(location).host, RAILWAY, `omdirigerer kun til samme vært: ${location}`);
});

test("kun GET/HEAD: POST med ?by= sætter ingen cookie", async () => {
  const res = await proxy(req(RAILWAY, "/?by=naestved", { method: "POST" }));
  assert.notEqual(res.status, 303);
  assert.equal(setCookie(res), "");
});

test("andre værter: ?by= har ingen virkning (rigtige by-domæner, ukendte værter, værter uden for PREVIEW_HOSTS)", async () => {
  for (const host of ["naestvedlokalt.dk", "slagelselokalt.dk", "evil.example", `x.${RAILWAY}`, "other.up.railway.app"]) {
    const res = await proxy(req(host, "/nyheder?by=holbaek"));
    assert.notEqual(res.status, 303, host);
    assert.equal(setCookie(res), "", host);
    assert.equal(res.headers.get("x-robots-tag"), null, `${host}: ingen preview-headere`);
  }
  // Uden PREVIEW_HOSTS er selv Railway-værten ikke en preview-vært
  delete env.PREVIEW_HOSTS;
  const res = await proxy(req(RAILWAY, "/nyheder?by=holbaek"));
  assert.notEqual(res.status, 303);
  assert.equal(setCookie(res), "");
});

test("PREVIEW_HOSTS med et rigtigt by-domæne gør aldrig by-domænet til preview-vært", async () => {
  env.PREVIEW_HOSTS = `naestvedlokalt.dk,${RAILWAY}`;
  const real = await proxy(req("naestvedlokalt.dk", "/nyheder?by=holbaek"));
  assert.notEqual(real.status, 303);
  assert.equal(setCookie(real), "");
  assert.equal(real.headers.get("x-robots-tag"), null);
  assert.match(real.headers.get("cache-control") ?? "", /s-maxage/, "rigtigt domæne forbliver cache'bart");
  assert.equal((await proxy(req(RAILWAY, "/?by=koege"))).status, 303);
});

test("/redaktion, /login og /api: ?by= påvirker dem ikke (ingen cookie, ingen omdirigering til by)", async () => {
  const redaktion = await proxy(req(RAILWAY, "/redaktion/artikler?by=naestved"));
  assert.equal(redaktion.status, 307, "uden session -> login, ikke by-skift");
  assert.match(redaktion.headers.get("location") ?? "", /\/login/);
  assert.equal(setCookie(redaktion), "");
  for (const p of ["/login?by=naestved", "/api/ingest/articles?by=naestved", "/api/cron/frontpage-rank?by=naestved", "/api/health?by=naestved"]) {
    const res = await proxy(req(RAILWAY, p));
    assert.notEqual(res.status, 303, p);
    assert.equal(setCookie(res), "", p);
  }
});

test("alle svar på en preview-vært: private/no-store, Vary: Cookie, noindex/nofollow (også med cache slået til)", async () => {
  for (const p of ["/", "/nyheder", "/soeg?q=byraad", "/om-mediet", "/redaktion", "/api/articles", "/robots.txt"]) {
    const res = await proxy(req(RAILWAY, p));
    assert.equal(res.headers.get("cache-control"), "private, no-store", p);
    assert.match(res.headers.get("vary") ?? "", /Cookie/, p);
    assert.match(res.headers.get("x-robots-tag") ?? "", /noindex, nofollow/, p);
    assert.equal(res.headers.get("cache-tag"), null, `${p}: ingen CDN-tag`);
  }
  // Statiske Next-filer røres ikke (matcheren udelader dem normalt; her sikres funktionen)
  const asset = await proxy(req(RAILWAY, "/_next/image?url=%2Fx.png"));
  assert.equal(asset.headers.get("x-robots-tag"), null);
  // Kontrol: samme sti på et rigtigt domæne er stadig cache'bar og uden noindex-header
  const real = await proxy(req("naestvedlokalt.dk", "/nyheder"));
  assert.match(real.headers.get("cache-control") ?? "", /s-maxage=60/);
  assert.equal(real.headers.get("x-robots-tag"), null);
});

test("preview-vært: legacy-redirect (æøå) og login-redirect bærer også no-store/noindex", async () => {
  const legacy = await proxy(req(RAILWAY, "/n%C3%A6vn"));
  if (legacy.status === 301) {
    assert.equal(legacy.headers.get("cache-control"), "private, no-store");
    assert.match(legacy.headers.get("x-robots-tag") ?? "", /noindex/);
  }
  const login = await proxy(req(RAILWAY, "/redaktion"));
  assert.equal(login.headers.get("cache-control"), "private, no-store");
  assert.match(login.headers.get("x-robots-tag") ?? "", /noindex/);
});

test("/api/site/switch: på preview-vært -> /?by=<nøgle> på samme vært; på rigtigt domæne uændret (målbyens domæne)", () => {
  const preview = switchRoute(req(RAILWAY, "/api/site/switch?site=naestved&redirect=/nyheder", { headers: { host: RAILWAY } }));
  assert.equal(preview.status, 307);
  assert.equal(preview.headers.get("location"), "/?by=naestved");
  const real = switchRoute(req("slagelselokalt.dk", "/api/site/switch?site=naestved&redirect=/nyheder", { headers: { host: "slagelselokalt.dk" } }));
  assert.equal(real.headers.get("location"), "https://naestvedlokalt.dk/nyheder");
  assert.equal(switchRoute(req(RAILWAY, "/api/site/switch?site=evil.example", { headers: { host: RAILWAY } })).headers.get("location"), "/");
});
