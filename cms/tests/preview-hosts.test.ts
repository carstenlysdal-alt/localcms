import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { decideCachePolicy, PREVIEW_RESPONSE_HEADERS, type CacheEnvConfig } from "../lib/cache/policy";
import { checkEnv } from "../lib/env";
import { ALL_NETWORK_SITES, cityKey, domainForKey, NETWORK_KEYS, networkHref, parseCityKey, previewHref, type NetworkSiteLink } from "../lib/network-sites";
import { isCityDomainHost, isPreviewHost, parsePreviewHosts, previewHostsFromEnv, previewParamApplies } from "../lib/preview";
import { buildRobotsGroups } from "../lib/seo/robots-policy";
import { classifyHost } from "../lib/seo/host";
import { resolveSiteDomain } from "../lib/site";

const RAILWAY = "lysdalcms-production.up.railway.app";
const prod = { isProduction: true, fallbackDomain: "slagelselokalt.dk", previewHosts: [RAILWAY] };

test("cityKey: ét kanonisk mapping fra domæne til by-nøgle for alle seks byer", () => {
  assert.deepEqual(
    ALL_NETWORK_SITES.map((s) => [s.domaene, cityKey(s.domaene)]),
    [
      ["slagelselokalt.dk", "slagelse"],
      ["naestvedlokalt.dk", "naestved"],
      ["holbaeklokalt.dk", "holbaek"],
      ["ringstedlokalt.dk", "ringsted"],
      ["koegelokalt.dk", "koege"],
      ["roskildelokalt.dk", "roskilde"],
    ],
  );
  assert.deepEqual([...NETWORK_KEYS].sort(), ["holbaek", "koege", "naestved", "ringsted", "roskilde", "slagelse"]);
  assert.equal(cityKey("www.NaestvedLokalt.dk"), "naestved");
  for (const s of ALL_NETWORK_SITES) assert.equal(s.key, cityKey(s.domaene));
});

test("parseCityKey/domainForKey: kun hvidlistede nøgler; alt andet ignoreres", () => {
  assert.equal(parseCityKey("naestved"), "naestved");
  assert.equal(parseCityKey(" Koege "), "koege");
  for (const bad of [null, undefined, "", "næstved", "naestvedlokalt.dk", "naestved,holbaek", "../redaktion", "x".repeat(40), "slagelse\r\nSet-Cookie: a=b", "__proto__"]) {
    assert.equal(parseCityKey(bad), null, String(bad));
  }
  assert.equal(domainForKey("holbaek"), "holbaeklokalt.dk");
  assert.equal(domainForKey("evil.example"), null);
});

test("parsePreviewHosts: gyldige hostnavne; by-domæner og ugyldige poster afvises (aldrig preview)", () => {
  assert.deepEqual(parsePreviewHosts(undefined).hosts, []);
  assert.deepEqual(parsePreviewHosts("").hosts, []);
  assert.deepEqual(parsePreviewHosts(` ${RAILWAY.toUpperCase()} , staging.example.dk:8080 ,, ${RAILWAY}`).hosts, [RAILWAY, "staging.example.dk"]);
  const conflict = parsePreviewHosts(`naestvedlokalt.dk, WWW.slagelselokalt.dk, ${RAILWAY}`);
  assert.deepEqual(conflict.hosts, [RAILWAY]);
  assert.deepEqual(conflict.cityDomainConflicts, ["naestvedlokalt.dk", "www.slagelselokalt.dk"]);
  const invalid = parsePreviewHosts("https://x.up.railway.app, *.up.railway.app, a/b, user@host");
  assert.deepEqual(invalid.hosts, []);
  assert.equal(invalid.invalid.length, 4);
  assert.equal(isCityDomainHost("www.koegelokalt.dk"), true);
  assert.equal(isCityDomainHost(RAILWAY), false);
  assert.deepEqual(previewHostsFromEnv({ PREVIEW_HOSTS: RAILWAY } as unknown as NodeJS.ProcessEnv), [RAILWAY]);
  assert.deepEqual(previewHostsFromEnv({} as unknown as NodeJS.ProcessEnv), []);
});

test("isPreviewHost: kun præcist hostnavn på hvidlisten (port ignoreres), aldrig delstrenge/underdomæner", () => {
  assert.equal(isPreviewHost(RAILWAY, [RAILWAY]), true);
  assert.equal(isPreviewHost(`${RAILWAY}:443`, [RAILWAY]), true);
  assert.equal(isPreviewHost(RAILWAY.toUpperCase(), [RAILWAY]), true);
  assert.equal(isPreviewHost(`x.${RAILWAY}`, [RAILWAY]), false);
  assert.equal(isPreviewHost(`${RAILWAY}.evil.example`, [RAILWAY]), false);
  assert.equal(isPreviewHost("naestvedlokalt.dk", [RAILWAY]), false);
  assert.equal(isPreviewHost(RAILWAY, []), false);
  assert.equal(isPreviewHost(null, [RAILWAY]), false);
});

test("resolveSiteDomain: preview-matrix (tilladt vært, gyldig/ugyldig cookie, standardby)", () => {
  // Gyldig cookie vælger byen
  const naestved = resolveSiteDomain(RAILWAY, { ...prod, previewCookie: "naestved" });
  assert.equal(naestved.domain, "naestvedlokalt.dk");
  assert.equal(naestved.preview, true);
  // Uden cookie: FALLBACK_SITE_DOMAIN; uden den igen: domæne null + preview (getCurrentSite tager første instans)
  assert.equal(resolveSiteDomain(RAILWAY, { ...prod }).domain, "slagelselokalt.dk");
  const noFallback = resolveSiteDomain(RAILWAY, { isProduction: true, previewHosts: [RAILWAY] });
  assert.equal(noFallback.domain, null);
  assert.equal(noFallback.preview, true);
  assert.equal(noFallback.allowFallback, true);
  // Ugyldig cookie (domæne, ukendt nøgle, injektion) ignoreres -> standardby
  for (const cookie of ["naestvedlokalt.dk", "ukendt", "", "slagelse; Path=/", "naestved\u0000", "naest ved"]) {
    assert.equal(resolveSiteDomain(RAILWAY, { ...prod, previewCookie: cookie }).domain, "slagelselokalt.dk", JSON.stringify(cookie));
  }
  // Port og stor/lille bogstaver
  assert.equal(resolveSiteDomain(`${RAILWAY.toUpperCase()}:443`, { ...prod, previewCookie: "koege" }).domain, "koegelokalt.dk");
});

test("resolveSiteDomain: cookien har INGEN virkning på rigtige domæner, ukendte værter eller uden PREVIEW_HOSTS", () => {
  // Rigtigt by-domæne: altid sig selv, uanset cookie
  for (const s of ALL_NETWORK_SITES) {
    const r = resolveSiteDomain(s.domaene, { ...prod, previewCookie: "roskilde" });
    assert.equal(r.domain, s.domaene);
    assert.equal(r.preview, undefined);
  }
  assert.equal(resolveSiteDomain("www.naestvedlokalt.dk", { ...prod, previewCookie: "roskilde" }).domain, "naestvedlokalt.dk");
  // Ukendt vært (ikke på listen): som før (fallback hvis sat, ellers 404-stien) og IKKE preview
  const unknown = resolveSiteDomain("evil.example", { ...prod, previewCookie: "naestved" });
  assert.equal(unknown.domain, "evil.example");
  assert.equal(unknown.preview, undefined);
  assert.equal(unknown.fallbackDomain, "slagelselokalt.dk");
  const unknownNoFallback = resolveSiteDomain("evil.example", { isProduction: true, previewHosts: [RAILWAY], previewCookie: "naestved" });
  assert.equal(unknownNoFallback.allowFallback, false, "ukendt vært uden fallback forbliver 404");
  // Railway-værten UDEN at stå i PREVIEW_HOSTS: cookien ignoreres (som i dag)
  const notListed = resolveSiteDomain(RAILWAY, { isProduction: true, fallbackDomain: "slagelselokalt.dk", previewCookie: "naestved" });
  assert.equal(notListed.domain, RAILWAY);
  assert.equal(notListed.preview, undefined);
  // Lokal vært uden i listen: uændret
  assert.equal(resolveSiteDomain("naestvedlokalt.localhost:3000", prod).domain, "naestvedlokalt.dk");
});

test("previewParamApplies: aldrig /redaktion, /login, /api eller /_next", () => {
  for (const p of ["/", "/nyheder", "/omraade/korsoer", "/soeg", "/om-mediet"]) assert.equal(previewParamApplies(p), true, p);
  for (const p of ["/redaktion", "/redaktion/artikler", "/login", "/api/ingest/articles", "/api/cron/frontpage-rank", "/api/health", "/_next/static/x.js"]) {
    assert.equal(previewParamApplies(p), false, p);
  }
});

test("cache-politik: ALT på en preview-vært er ikke-cache'bart (også når cache er slået til); andre værter uændret", () => {
  const on: CacheEnvConfig = { enabled: true, sMaxAge: 60, staleWhileRevalidate: 300, searchSMaxAge: 30 };
  for (const p of ["/", "/nyheder", "/soeg", "/om-mediet"]) {
    const d = decideCachePolicy({ method: "GET", pathname: p, config: on, previewHost: true });
    assert.equal(d.cacheable, false, p);
    assert.equal(d.reason, "preview-host");
    assert.equal(d.cacheControl, undefined);
    assert.equal(decideCachePolicy({ method: "GET", pathname: p, config: on, previewHost: false }).cacheable, true, `${p} på rigtigt domæne uændret`);
  }
  assert.equal(PREVIEW_RESPONSE_HEADERS["Cache-Control"], "private, no-store");
  assert.match(PREVIEW_RESPONSE_HEADERS.Vary, /Cookie/);
  assert.match(PREVIEW_RESPONSE_HEADERS["X-Robots-Tag"], /noindex/);
  assert.match(PREVIEW_RESPONSE_HEADERS["X-Robots-Tag"], /nofollow/);
});

test("noindex: en preview-vært er altid 'ukendt' (robots Disallow: /), selv hvis den viser en bys eget domæne", () => {
  const naestvedOnRailway = classifyHost(RAILWAY, "naestvedlokalt.dk", [RAILWAY]);
  assert.equal(naestvedOnRailway.known, false);
  assert.deepEqual(buildRobotsGroups({ known: naestvedOnRailway.known }), [{ userAgent: "*", disallow: ["/"] }]);
  // Også når værten ved en fejl lå lig sitets domæne: preview-listen vinder (men by-domæner kan aldrig komme på listen, se parsePreviewHosts)
  assert.equal(classifyHost("naestvedlokalt.dk", "naestvedlokalt.dk", ["naestvedlokalt.dk"]).known, false);
  // Uden preview-liste: eksisterende adfærd er uændret
  assert.equal(classifyHost(RAILWAY, "slagelselokalt.dk").known, false);
  assert.equal(classifyHost("naestvedlokalt.dk", "naestvedlokalt.dk").known, true);
  assert.equal(classifyHost("www.naestvedlokalt.dk", "naestvedlokalt.dk", [RAILWAY]).known, true);
});

const link = (key: string, extra: Partial<NetworkSiteLink> = {}): NetworkSiteLink => {
  const s = ALL_NETWORK_SITES.find((x) => x.key === key)!;
  return { ...s, origin: `https://${s.domaene}`, ...extra };
};

test("networkHref: på preview-vært altid /?by=<nøgle> på samme vært (stien bevares ikke); rigtige domæner uændret", () => {
  const sections = ["/nyheder", "/nyheder/politik"];
  assert.equal(networkHref(link("naestved", { previewBy: "naestved" }), "/nyheder/politik", sections), "/?by=naestved");
  assert.equal(networkHref(link("koege", { previewBy: "koege" }), "/"), "/?by=koege");
  assert.equal(networkHref(link("holbaek"), "/nyheder/politik", sections), "https://holbaeklokalt.dk/nyheder/politik");
  assert.equal(networkHref(link("holbaek"), "/"), "https://holbaeklokalt.dk/");
  // Bagudkompatibel: gammel signatur uden origin/previewBy
  assert.equal(networkHref({ domaene: "x.dk" }, "/kalender"), "https://x.dk/kalender");
  // Valgfri 4. parameter; ugyldig nøgle falder tilbage til domænelinket (aldrig en vilkårlig værdi i href)
  assert.equal(networkHref(link("ringsted"), "/", [], { previewBy: "ringsted" }), "/?by=ringsted");
  assert.equal(networkHref(link("ringsted"), "/", [], { previewBy: "x&evil=1" }), "https://ringstedlokalt.dk/");
  assert.equal(previewHref("roskilde"), "/?by=roskilde");
});

test("checkEnv: PREVIEW_HOSTS-advarsler (by-domæne ignoreres, ugyldig post, produktionsnote) — uden for produktion intet", () => {
  const base = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://u:p@h:5432/d",
    AUTH_SECRET: "x".repeat(40),
    NEXT_PUBLIC_APP_URL: "https://slagelselokalt.dk",
    CRON_SECRET: "c".repeat(20),
  };
  const warn = (extra: Record<string, string>) => checkEnv({ ...base, ...extra } as unknown as NodeJS.ProcessEnv).warnings.filter((w) => w.includes("PREVIEW_HOSTS"));
  assert.deepEqual(warn({}), []);
  const ok = warn({ PREVIEW_HOSTS: RAILWAY });
  assert.equal(ok.length, 1);
  assert.match(ok[0], /Fjern PREVIEW_HOSTS/);
  const conflict = warn({ PREVIEW_HOSTS: `naestvedlokalt.dk,${RAILWAY}` });
  assert.ok(conflict.some((w) => /rigtigt by-domæne \(naestvedlokalt\.dk\)/.test(w)));
  assert.ok(warn({ PREVIEW_HOSTS: "https://x.dk/" }).some((w) => /ugyldig post/.test(w)));
  const report = checkEnv({ ...base, PREVIEW_HOSTS: "naestvedlokalt.dk" } as unknown as NodeJS.ProcessEnv);
  assert.equal(report.ok, true, "PREVIEW_HOSTS stopper aldrig opstarten");
  assert.deepEqual(checkEnv({ NODE_ENV: "development", PREVIEW_HOSTS: "naestvedlokalt.dk" } as unknown as NodeJS.ProcessEnv).warnings.filter((w) => w.includes("PREVIEW")), []);
});

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

test("isolation: redaktion, ingest, cron og login kender hverken preview-cookien eller PREVIEW_HOSTS", () => {
  const root = path.resolve(__dirname, "..");
  const dirs = ["app/redaktion", "app/api/ingest", "app/api/cron", "app/login", "app/api/auth"].map((d) => path.join(root, d));
  const files = [...dirs.flatMap((d) => sourceFiles(d)), path.join(root, "lib/auth.ts"), path.join(root, "lib/redaktion-access.ts"), path.join(root, "lib/admin-guard.ts")];
  assert.ok(files.length > 20);
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    assert.ok(!/lk_by|PREVIEW_COOKIE|previewHostsFromEnv|PREVIEW_HOSTS|isPreviewHost/.test(src), `${path.relative(root, f)} må ikke bruge preview-valget`);
    assert.ok(!/getCurrentSite|resolveSiteDomain/.test(src), `${path.relative(root, f)} må ikke vælge tenant efter vært`);
  }
});
