import assert from "node:assert/strict";
import test from "node:test";
import { cacheHeader, cacheTagForHost, classifyPath, decideCachePolicy, hasSessionCookie, resolveCacheConfig, type CacheEnvConfig } from "../lib/cache/policy";
import { purgeInstance, purgeSite, purgeTags, purgeUrls, sitePurgeUrls } from "../lib/cache/purge";
import { etagFor, isNotModified } from "../lib/cache/etag";

const on: CacheEnvConfig = { enabled: true, sMaxAge: 60, staleWhileRevalidate: 300, searchSMaxAge: 30 };

test("cache-politik: anonym GET på offentlige sider er cache'bar med s-maxage + stale-while-revalidate", () => {
  const home = decideCachePolicy({ method: "GET", pathname: "/", config: on });
  assert.equal(home.cacheable, true);
  assert.equal(home.cacheControl, "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  for (const p of ["/nyheder", "/nyheder/min-artikel", "/emne/politik", "/omraade/korsoer", "/forfatter/jens", "/kalender", "/om-mediet", "/priser", "/nyhedsbrev", "/indsend"]) {
    assert.equal(decideCachePolicy({ method: "GET", pathname: p, config: on }).cacheable, true, p);
  }
  assert.equal(decideCachePolicy({ method: "HEAD", pathname: "/", config: on }).cacheable, true);
});

test("cache-politik: aldrig /redaktion, /login, /api, token-sider, private sider, filer, uploads", () => {
  for (const p of ["/redaktion", "/redaktion/artikler", "/login", "/api/articles", "/api/chat", "/_next/image", "/uploads/a.jpg", "/qa/abc", "/interview/abc", "/meddeler/abc", "/partner/abc", "/gemte", "/profil", "/velkommen", "/og/by.jpg", "/feed.xml", "/sitemap.xml", "/icons/192.png"]) {
    const d = decideCachePolicy({ method: "GET", pathname: p, config: on });
    assert.equal(d.cacheable, false, p);
    assert.equal(d.cacheControl, undefined, p);
  }
});

test("cache-politik: aldrig ved session-cookie, Authorization eller ikke-GET", () => {
  assert.equal(decideCachePolicy({ method: "GET", pathname: "/", cookieHeader: "authjs.session-token=abc", config: on }).reason, "session-cookie");
  assert.equal(decideCachePolicy({ method: "GET", pathname: "/", cookieHeader: "foo=1; __Secure-authjs.session-token=abc", config: on }).cacheable, false);
  assert.equal(decideCachePolicy({ method: "GET", pathname: "/", cookieHeader: "next-auth.session-token=abc", config: on }).cacheable, false);
  assert.equal(decideCachePolicy({ method: "GET", pathname: "/", cookieHeader: "authjs.csrf-token=abc", config: on }).cacheable, false);
  assert.equal(decideCachePolicy({ method: "GET", pathname: "/", cookieHeader: "_ga=1; theme=dark", config: on }).cacheable, true, "ikke-session-cookies blokerer ikke");
  assert.equal(decideCachePolicy({ method: "GET", pathname: "/", hasAuthorization: true, config: on }).cacheable, false);
  for (const m of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal(decideCachePolicy({ method: m, pathname: "/", config: on }).cacheable, false, m);
  assert.equal(hasSessionCookie(null), false);
  assert.equal(hasSessionCookie("a=1"), false);
});

test("cache-politik: søgning caches kort; slået fra i udvikling som standard", () => {
  const s = decideCachePolicy({ method: "GET", pathname: "/soeg", search: "?q=bil", config: on });
  assert.equal(s.cls, "search");
  assert.equal(s.cacheControl, "public, max-age=0, s-maxage=30, stale-while-revalidate=60");
  assert.equal(decideCachePolicy({ method: "GET", pathname: "/", config: { ...on, enabled: false } }).cacheable, false);
  assert.equal(resolveCacheConfig({ NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv).enabled, false);
  assert.equal(resolveCacheConfig({ NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv).enabled, true);
  assert.equal(resolveCacheConfig({ NODE_ENV: "production", CACHE_PUBLIC_HTML: "0" } as unknown as NodeJS.ProcessEnv).enabled, false);
  assert.equal(resolveCacheConfig({ NODE_ENV: "development", CACHE_PUBLIC_HTML: "1" } as unknown as NodeJS.ProcessEnv).enabled, true);
  assert.equal(resolveCacheConfig({ CACHE_HTML_S_MAXAGE: "120", CACHE_HTML_SWR: "x" } as unknown as NodeJS.ProcessEnv).sMaxAge, 120);
  assert.equal(resolveCacheConfig({ CACHE_HTML_SWR: "x" } as unknown as NodeJS.ProcessEnv).staleWhileRevalidate, 300);
});

test("cache-hjælpere", () => {
  assert.equal(classifyPath("/"), "home");
  assert.equal(classifyPath("/redaktionelt"), "page", "kun præcist /redaktion-præfiks er privat");
  assert.equal(cacheHeader(10, 20), "public, max-age=0, s-maxage=10, stale-while-revalidate=20");
  assert.equal(cacheTagForHost("www.NaestvedLokalt.dk:443"), "host:naestvedlokalt.dk");
});

test("ETag og 304-sammenligning", () => {
  const e = etagFor("<rss/>");
  assert.match(e, /^W\/"[A-Za-z0-9_-]+"$/);
  assert.equal(etagFor("<rss/>"), e);
  assert.notEqual(etagFor("<rss2/>"), e);
  assert.equal(isNotModified(e, e), true);
  assert.equal(isNotModified(`"x", ${e}`, e), true);
  assert.equal(isNotModified(e.replace("W/", ""), e), true, "svag sammenligning");
  assert.equal(isNotModified("*", e), true);
  assert.equal(isNotModified('W/"andet"', e), false);
  assert.equal(isNotModified(null, e), false);
});

test("purge: no-op uden CF_API_TOKEN/CF_ZONE_ID", async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return new Response("{}");
  };
  const none = { token: "", zoneId: "", fetchImpl } as never;
  assert.deepEqual(await purgeUrls(["https://a.dk/"], none), { ok: true, skipped: true });
  assert.deepEqual(await purgeTags(["host:a.dk"], none), { ok: true, skipped: true });
  assert.deepEqual(await purgeSite("a.dk", [], none), { ok: true, skipped: true });
  assert.deepEqual(await purgeSite(null), { ok: true, skipped: true });
  const prev = process.env.CF_API_TOKEN;
  delete process.env.CF_API_TOKEN;
  assert.deepEqual(await purgeInstance("x"), { ok: true, skipped: true });
  if (prev !== undefined) process.env.CF_API_TOKEN = prev;
  assert.equal(called, false);
});

test("purge: kalder Cloudflare med bearer-token, batcher i 30 og grupperer pr. zone", async () => {
  const calls: Array<{ url: string; auth: string | null; body: { files?: string[]; tags?: string[] } }> = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ url, auth: new Headers(init?.headers).get("authorization"), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  const urls = Array.from({ length: 65 }, (_, i) => `https://a.dk/p${i}`);
  const r = await purgeUrls(urls, { token: "tok", zoneId: "zone1", fetchImpl } as never);
  assert.deepEqual(r, { ok: true, purged: 65 });
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, "https://api.cloudflare.com/client/v4/zones/zone1/purge_cache");
  assert.equal(calls[0].auth, "Bearer tok");
  assert.equal(calls[0].body.files?.length, 30);

  calls.length = 0;
  await purgeUrls(["https://a.dk/", "https://b.dk/"], { token: "tok", zoneIds: { "a.dk": "zA", "b.dk": "zB" }, fetchImpl } as never);
  assert.deepEqual(calls.map((c) => c.url.split("/zones/")[1].split("/")[0]).sort(), ["zA", "zB"]);

  calls.length = 0;
  const t = await purgeTags(["host:a.dk"], { token: "tok", zoneId: "z", fetchImpl } as never);
  assert.equal(t.ok, true);
  assert.deepEqual(calls[0].body.tags, ["host:a.dk"]);

  const urlsForSite = sitePurgeUrls("naestvedlokalt.dk", ["/nyheder/x"]);
  assert.ok(urlsForSite.includes("https://naestvedlokalt.dk/") && urlsForSite.includes("https://naestvedlokalt.dk/feed.xml") && urlsForSite.includes("https://naestvedlokalt.dk/nyheder/x"));
});

test("purge: fejl og timeout kaster aldrig", async () => {
  const bad = await purgeUrls(["https://a.dk/"], { token: "t", zoneId: "z", fetchImpl: async () => new Response("x", { status: 500 }) } as never);
  assert.equal(bad.ok, false);
  const boom = await purgeSite("a.dk", [], { token: "t", zoneId: "z", fetchImpl: async () => { throw new Error("net"); } } as never);
  assert.equal(boom.ok, false);
  const slow = await purgeUrls(["https://a.dk/"], { token: "t", zoneId: "z", timeoutMs: 20, fetchImpl: () => new Promise<Response>(() => undefined) } as never);
  assert.equal(slow.ok, false);
});
