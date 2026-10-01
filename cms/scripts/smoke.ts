/**
 * Smoke-test mod en kørende CMS (dev, `next start` eller deployet). Kun fetch — ingen browser.
 *
 *   npm run smoke -- http://127.0.0.1:3000
 *   npm run smoke -- http://127.0.0.1:3000 --cities naestvedlokalt,slagelselokalt
 *   npm run smoke -- https://naestvedlokalt.dk --direct      # ét rigtigt domæne, ingen Host-override
 *   npm run smoke -- http://127.0.0.1:3000 --json            # maskinlæsbart resultat
 *   npm run smoke -- http://127.0.0.1:3000 --delay 0         # ingen pacing (default 250 ms mellem kald)
 *
 * Pr. by sendes `Host: <by>.localhost:<port>` til base-URL'en (Node's fetch resolver ikke *.localhost,
 * så vi forbinder til base-URL'en og overstyrer Host). Exit 1 ved mindst ét FAIL; WARN fejler ikke.
 */

import http from "node:http";
import https from "node:https";

interface City {
  key: string; // <key>.localhost
  name: string; // brandnavn (og:site_name)
  domain: string; // kanonisk domæne
  place: string; // stednavn der ikke må lække til andre byer
}

const ALL_CITIES: City[] = [
  { key: "naestvedlokalt", name: "NæstvedLokalt", domain: "naestvedlokalt.dk", place: "Næstved" },
  { key: "slagelselokalt", name: "SlagelseLokalt", domain: "slagelselokalt.dk", place: "Slagelse" },
  { key: "holbaeklokalt", name: "HolbækLokalt", domain: "holbaeklokalt.dk", place: "Holbæk" },
  { key: "ringstedlokalt", name: "RingstedLokalt", domain: "ringstedlokalt.dk", place: "Ringsted" },
  { key: "koegelokalt", name: "KøgeLokalt", domain: "koegelokalt.dk", place: "Køge" },
  { key: "roskildelokalt", name: "RoskildeLokalt", domain: "roskildelokalt.dk", place: "Roskilde" },
];

type Level = "PASS" | "FAIL" | "WARN";
interface Result {
  scope: string;
  check: string;
  level: Level;
  detail?: string;
}

const results: Result[] = [];
const TIMEOUT_MS = 30_000;

function record(scope: string, check: string, ok: boolean, detail?: string, level: Level = "FAIL") {
  results.push({ scope, check, level: ok ? "PASS" : level, detail: ok ? undefined : detail });
}

interface Res {
  status: number;
  headers: Headers;
  body: string;
  location: string | null;
}

// node:http i stedet for fetch: undici ignorerer en overstyret Host-header, og vi skal netop forbinde til
// base-URL'en men udgive os for <by>.localhost.
let delayMs = 250; // ~240 req/min: under proxy.ts' pr.-IP-sidegrænse (300/min for "human")
let lastRequestAt = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type GetInit = { method?: string; headers?: Record<string, string>; body?: string; noRetry?: boolean };

/** get + høflig pacing + genforsøg efter Retry-After ved 429 (proxy.ts' sidegrænse), så smoke ikke selv udløser bot-forsvaret. */
async function get(base: URL, path: string, host: string | null, init: GetInit = {}): Promise<Res> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + delayMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    const res = await rawGet(base, path, host, init);
    if (res.status !== 429 || init.noRetry || attempt >= 3) return res;
    const retry = Math.min(65, Math.max(1, Number(res.headers.get("retry-after")) || 10));
    console.error(`  (429 på ${path}, venter ${retry} s)`);
    await sleep(retry * 1000);
  }
}

async function rawGet(base: URL, path: string, host: string | null, init: GetInit): Promise<Res> {
  const url = new URL(path, base);
  const lib = url.protocol === "https:" ? https : http;
  const headers: Record<string, string> = { "user-agent": "cms-smoke/1.0 (+ci)", ...(init.headers ?? {}) };
  if (host) headers.host = host;
  if (init.body !== undefined) headers["content-length"] = String(Buffer.byteLength(init.body));
  return new Promise<Res>((resolve, reject) => {
    const req = lib.request(url, { method: init.method ?? "GET", headers, timeout: TIMEOUT_MS }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const h = new Headers();
        for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) h.set(k, Array.isArray(v) ? v.join(", ") : v);
        const ct = h.get("content-type") ?? "";
        const body = /text|json|xml|javascript/.test(ct) ? Buffer.concat(chunks).toString("utf8") : "";
        resolve({ status: res.statusCode ?? 0, headers: h, body, location: h.get("location") });
      });
    });
    req.on("timeout", () => req.destroy(new Error(`timeout efter ${TIMEOUT_MS} ms: ${url.pathname}`)));
    req.on("error", reject);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

const meta = (html: string, attr: "property" | "name", key: string) =>
  new RegExp(`<meta[^>]*${attr}="${key}"[^>]*content="([^"]*)"`, "i").exec(html)?.[1] ??
  new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${attr}="${key}"`, "i").exec(html)?.[1] ??
  null;
const canonical = (html: string) => /<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i.exec(html)?.[1] ?? null;
const title = (html: string) => /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "";
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");

function jsonLd(html: string): { blocks: unknown[]; errors: number } {
  const blocks: unknown[] = [];
  let errors = 0;
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {
      errors++;
    }
  }
  return { blocks, errors };
}

function flattenLd(blocks: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (n: unknown) => {
    if (Array.isArray(n)) n.forEach(visit);
    else if (n && typeof n === "object") {
      out.push(n as Record<string, unknown>);
      visit((n as Record<string, unknown>)["@graph"]);
    }
  };
  visit(blocks);
  return out;
}

const ARTICLE_LINK = /href="\/([a-z0-9-]+)\/([a-z0-9-]+)"/g;

async function articleSlugs(base: URL, host: string | null) {
  const r = await get(base, "/api/articles?limit=100", host);
  if (r.status !== 200) return { status: r.status, slugs: new Set<string>(), site: null as string | null, raw: r.body };
  const j = JSON.parse(r.body) as { data: { slug: string }[]; site?: { domaene?: string } };
  return { status: 200, slugs: new Set(j.data.map((a) => a.slug)), site: j.site?.domaene ?? null, raw: r.body };
}

async function checkCity(base: URL, city: City, others: City[], hostFor: (c: City) => string | null, slugSets: Map<string, Set<string>>) {
  const scope = city.key;
  const host = hostFor(city);
  const t0 = Date.now();

  // 1) Forside
  const home = await get(base, "/", host);
  record(scope, "forside 200", home.status === 200, `status ${home.status}`);
  if (home.status !== 200) return;
  const t = title(home.body);
  record(scope, "forside-titel indeholder byens navn", decode(t).includes(city.name) || decode(t).includes(city.place), `title="${t}"`);
  const leakFields: [string, string | null][] = [
    ["title", t],
    ["canonical", canonical(home.body)],
    ["og:url", meta(home.body, "property", "og:url")],
    ["og:site_name", meta(home.body, "property", "og:site_name")],
    ["og:title", meta(home.body, "property", "og:title")],
    ["og:image", meta(home.body, "property", "og:image")],
    ["description", meta(home.body, "name", "description")],
  ];
  const leaks: string[] = [];
  for (const o of others) {
    for (const [field, value] of leakFields) {
      if (value && (decode(value).includes(o.place) || value.toLowerCase().includes(o.key))) leaks.push(`${field} nævner ${o.place}`);
    }
  }
  record(scope, "ingen anden bys navn i title/canonical/og/description", leaks.length === 0, leaks.join("; "));
  const canon = canonical(home.body);
  record(scope, "canonical peger på byens eget domæne", !!canon && new URL(canon).hostname === city.domain, `canonical=${canon}`);

  // JSON-LD på forsiden (NewsMediaOrganization hører til byen)
  const ldHome = jsonLd(home.body);
  const orgs = flattenLd(ldHome.blocks).filter((n) => String(n["@type"]).includes("Organization"));
  record(scope, "forside JSON-LD parser", ldHome.errors === 0 && ldHome.blocks.length > 0, `${ldHome.errors} fejl, ${ldHome.blocks.length} blokke`);
  record(scope, "forside JSON-LD organisation tilhører byen", orgs.some((o) => o.name === city.name), `organisationer: ${orgs.map((o) => o.name).join(",")}`);

  // Artikellinks på forsiden må ikke tilhøre en anden bys artikelsæt
  const mine = slugSets.get(city.key) ?? new Set<string>();
  const homeArticleLinks = [...home.body.matchAll(ARTICLE_LINK)].map((m) => ({ path: `/${m[1]}/${m[2]}`, slug: m[2] }));
  const foreign = homeArticleLinks.filter((l) => !mine.has(l.slug) && others.some((o) => slugSets.get(o.key)?.has(l.slug)));
  record(scope, "forsidens artikellinks tilhører kun byen", foreign.length === 0, `fremmede: ${foreign.slice(0, 3).map((l) => l.path).join(", ")}`);
  const nameLeakText = home.body
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(footer|nav|header)[\s\S]*?<\/\1>/gi, "");
  const stray = others.filter((o) => new RegExp(`\\b${o.place}\\b`).test(nameLeakText));
  record(scope, "synlig forsidetekst (uden header/nav/footer) nævner ikke andre byer", stray.length === 0, stray.map((o) => o.place).join(", "), "WARN");

  // 2) Artikelside
  const art = homeArticleLinks.find((l) => mine.has(l.slug));
  if (!art) {
    record(scope, "artikellink fundet på forsiden", false, "ingen /sektion/slug-link der matcher /api/articles");
  } else {
    const a = await get(base, art.path, host);
    record(scope, `artikel ${art.path} 200`, a.status === 200, `status ${a.status}`);
    if (a.status === 200) {
      const ac = canonical(a.body);
      record(scope, "artikel canonical = byens domæne + sti", !!ac && new URL(ac).hostname === city.domain && new URL(ac).pathname === art.path, `canonical=${ac}`);
      const ld = jsonLd(a.body);
      const nodes = flattenLd(ld.blocks);
      const news = nodes.find((n) => /NewsArticle|Article/.test(String(n["@type"])));
      record(scope, "artikel JSON-LD parser og indeholder NewsArticle med headline", ld.errors === 0 && !!news && !!news.headline, `${ld.errors} parse-fejl, article=${!!news}`);
      const og = meta(a.body, "property", "og:image");
      if (!og) record(scope, "artikel og:image findes", false, "mangler");
      else {
        const p = new URL(og);
        const img = await get(base, p.pathname + p.search, host);
        const ct = img.headers.get("content-type") ?? "";
        record(scope, "artikel og:image henter 200 som billede", img.status === 200 && ct.startsWith("image/"), `status ${img.status} ${ct}`);
      }
    }
  }

  // 3) Faste sider
  for (const path of ["/soeg", "/om-mediet/privatliv", "/nyhedsbrev"]) {
    const r = await get(base, path, host);
    record(scope, `${path} 200`, r.status === 200, `status ${r.status}`);
  }

  // 4) 404 med links
  const nf = await get(base, "/findes-ikke-smoke-test-xyz", host);
  const anchors = [...nf.body.matchAll(/<a [^>]*href="(\/[^"]*)"/gi)].filter((m) => !m[1].startsWith("/_next") && !m[1].startsWith("//"));
  record(scope, "ukendt sti giver 404", nf.status === 404, `status ${nf.status}`);
  const payloadLinks = /(?:\\"|")href(?:\\"|")\s*:\s*(?:\\"|")\/(?:soeg)?(?:\\"|")/.test(nf.body);
  if (anchors.length > 0) record(scope, "404-siden har brugbare links i server-HTML", true);
  else if (payloadLinks) record(scope, "404-siden har brugbare links i server-HTML", false, "kun i RSC-payload (404 klientrenderes: ingen h1/links uden JavaScript)", "WARN");
  else record(scope, "404-siden har brugbare links", false, "ingen interne links i 404-svaret");
  const nf3 = await get(base, "/a/b/c-findes-ikke", host);
  record(scope, "ukendt dyb sti: 404 med links i server-HTML", nf3.status === 404 && /<a [^>]*href="\//.test(nf3.body), `status ${nf3.status}`);

  // 5) Nyhedsbrev: valideringsfejl (ingen data gemmes)
  const nl = await get(base, "/api/newsletter/subscribe", host, {
    method: "POST",
    noRetry: true,
    headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${(ALL_CITIES.indexOf(city) % 200) + 10}` },
    body: JSON.stringify({ email: "ikke-en-mail", samtykke: false }),
  });
  let nlJson: { ok?: boolean; error?: string } = {};
  try {
    nlJson = JSON.parse(nl.body);
  } catch {
    /* ignore */
  }
  if (nl.status === 429) record(scope, "nyhedsbrev med ugyldig mail -> 400 (fik 429: rate limit grebet, validering ikke nået)", false, `status 429`, "WARN");
  else record(scope, "nyhedsbrev med ugyldig mail -> 400 + fejltekst", nl.status === 400 && nlJson.ok === false && !!nlJson.error, `status ${nl.status} ${nl.body.slice(0, 80)}`);

  // 6) Auth-grænser
  const red = await get(base, "/redaktion", host);
  record(scope, "/redaktion omdirigerer til /login uden session", [301, 302, 303, 307, 308].includes(red.status) && /\/login/.test(red.location ?? ""), `status ${red.status} location=${red.location}`);
  const partner = await get(base, "/partner/smoke-test-ugyldigt-token", host);
  record(scope, "/partner/<falsk token> sendes IKKE til login", !(partner.status >= 300 && partner.status < 400) && ![401, 403].includes(partner.status), `status ${partner.status} location=${partner.location}`);

  // 7) API: kun egen by
  const api = slugSets.get(city.key);
  const apiRes = await articleSlugs(base, host);
  record(scope, "/api/articles 200 med artikler", apiRes.status === 200 && (api?.size ?? 0) > 0, `status ${apiRes.status}`);
  if (apiRes.status === 200) {
    record(scope, "/api/articles site.domaene = byens domæne", apiRes.site === city.domain, `site=${apiRes.site}`);
    const cross = others.filter((o) => [...(slugSets.get(o.key) ?? [])].some((s) => api?.has(s)));
    record(scope, "/api/articles indeholder ingen anden bys artikler", cross.length === 0, `overlap med ${cross.map((o) => o.key).join(",")}`);
    record(scope, "/api/articles lækker ikke instansId/oprindeligKontakt", !/"instansId"|oprindeligKontakt/.test(apiRes.raw), "felt fundet i svaret");
  }

  // 8) Sikkerhedsheadere (report-only CSP accepteres)
  const h = home.headers;
  const missing: string[] = [];
  if (h.get("x-content-type-options")?.toLowerCase() !== "nosniff") missing.push("x-content-type-options");
  if (!h.get("x-frame-options") && !/frame-ancestors/.test(h.get("content-security-policy") ?? h.get("content-security-policy-report-only") ?? "")) missing.push("x-frame-options/frame-ancestors");
  if (!h.get("referrer-policy")) missing.push("referrer-policy");
  if (!h.get("permissions-policy")) missing.push("permissions-policy");
  if (!h.get("content-security-policy") && !h.get("content-security-policy-report-only")) missing.push("content-security-policy(-report-only)");
  record(scope, "sikkerhedsheadere til stede på forsiden", missing.length === 0, `mangler: ${missing.join(", ")}`);
  if (base.protocol === "https:") record(scope, "HSTS sendes over https", !!h.get("strict-transport-security"), "mangler strict-transport-security");

  record(scope, `(tid) ${Date.now() - t0} ms`, true);
}

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n: string) => argv.includes(`--${n}`);
  const opt = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--cities" && argv[i - 1] !== "--delay");
  const baseArg = positional[0] ?? process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
  const base = new URL(baseArg);
  const direct = flag("direct");
  if (opt("delay") !== undefined) delayMs = Number(opt("delay"));
  const wanted = opt("cities")?.split(",").map((s) => s.trim());
  const cities = direct ? [] : ALL_CITIES.filter((c) => !wanted || wanted.includes(c.key));

  const started = Date.now();
  const hostFor = (c: City) => `${c.key}.localhost${base.port ? `:${base.port}` : ""}`;

  // Fælles: health (kun én gang)
  try {
    const health = await get(base, "/api/health", direct ? null : cities[0] ? hostFor(cities[0]) : null);
    record("global", "/api/health 200 med status ok", health.status === 200 && /"status"\s*:\s*"ok"/.test(health.body), `status ${health.status} ${health.body.slice(0, 80)}`);
  } catch (e) {
    record("global", "/api/health 200", false, `serveren svarer ikke: ${(e as Error).message}`);
    return finish(started);
  }

  if (direct) {
    // Ét rigtigt domæne: find byen ud fra hostname og kør samme checks uden Host-override.
    const city = ALL_CITIES.find((c) => base.hostname === c.domain || base.hostname.endsWith(`.${c.domain}`));
    if (!city) {
      record("global", "kendt by-domæne", false, `${base.hostname} matcher ingen by`);
      return finish(started);
    }
    const others = ALL_CITIES.filter((c) => c !== city);
    const sets = new Map<string, Set<string>>([[city.key, (await articleSlugs(base, null)).slugs]]);
    await checkCity(base, city, others, () => null, sets);
    return finish(started);
  }

  // Forhent artikelsæt for alle byer først (bruges til lækage-tjek på tværs)
  const slugSets = new Map<string, Set<string>>();
  for (const c of ALL_CITIES) {
    try {
      slugSets.set(c.key, (await articleSlugs(base, hostFor(c))).slugs);
    } catch {
      slugSets.set(c.key, new Set());
    }
  }
  for (const city of cities) {
    try {
      await checkCity(base, city, ALL_CITIES.filter((c) => c !== city), hostFor, slugSets);
    } catch (e) {
      record(city.key, "kørsel", false, (e as Error).message);
    }
  }
  finish(started);
}

function finish(started: number) {
  const fails = results.filter((r) => r.level === "FAIL");
  const warns = results.filter((r) => r.level === "WARN");
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ ok: fails.length === 0, results }, null, 2));
  } else {
    let scope = "";
    for (const r of results) {
      if (r.scope !== scope) {
        scope = r.scope;
        console.log(`\n== ${scope} ==`);
      }
      console.log(`  ${r.level.padEnd(4)} ${r.check}${r.detail ? `  -> ${r.detail}` : ""}`);
    }
    console.log(`\nSmoke: ${results.length - fails.length - warns.length} pass, ${warns.length} warn, ${fails.length} fail (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  }
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
