import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { createApiKey, hashApiKey, extractBearer } from "../lib/ingest/auth";
import { INGEST_DRAFT_STATUS } from "../lib/ingest/articles";
import { ARTICLE_STATUSES } from "../lib/workflow";
import { POST as postSignals } from "../app/api/ingest/signals/route";
import { POST as postArticles } from "../app/api/ingest/articles/route";
import { GET as getHealth } from "../app/api/ingest/health/route";
import { setRateLimitStore, MemoryRateLimitStore } from "../lib/ratelimit";

const run = Date.now().toString(36);
const BASE = "http://test.local";
let a: { id: string; key: string; prefix: string; keyId: string };
let b: { id: string; key: string };
let readOnlyKey: string;
let revokedKey: string;
let categoryKrimiId: string;
const createdInstances: string[] = [];

function req(path: string, key: string | null, body?: unknown, method = "POST") {
  return new Request(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}), "x-forwarded-for": "198.51.100.7" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const signal = (over: Record<string, unknown> = {}) => ({
  externalId: `sig-${run}-1`,
  overskrift: "Byrådet behandler ny lokalplan",
  braedtekst: "Dagsorden punkt 4 <script>alert(1)</script> om ny lokalplan.",
  kilde: "Næstved Kommune",
  kildeUrl: "https://naestved.dk/dagsorden/2026-10-01?utm_source=agent",
  sourceType: "kommune_dagsorden",
  geo: { omraade: "Test Område", postnr: "4700" },
  publishedAt: "2026-10-01T08:00:00Z",
  ...over,
});

const article = (over: Record<string, unknown> = {}) => ({
  externalId: `art-${run}-1`,
  titel: "Ny lokalplan sendt i høring",
  manchet: "Planen omfatter 40 boliger.",
  tekst: "Første afsnit <img src=x onerror=alert(1)> med tekst.\n\nAndet afsnit & mere.",
  aiBrug: ["Udkast"],
  sources: [{ url: "https://naestved.dk/dagsorden/2026-10-01", dato: "2026-10-01", sourceType: "kommune_dagsorden" }],
  ...over,
});

before(async () => {
  setRateLimitStore(new MemoryRateLimitStore());
  const mk = async (suffix: string) => {
    const inst = await db.instance.create({
      data: { navn: `IngestTest${suffix}${run}`, domaene: `ingest-${suffix}-${run}.test`, geografiskDækning: [], kategoriTaksonomi: [], markingTekster: {} },
    });
    createdInstances.push(inst.id);
    return inst;
  };
  const ia = await mk("a");
  const ib = await mk("b");
  await db.geoTag.create({ data: { instansId: ia.id, navn: "Test Område", slug: "test-omraade" } });
  await db.geoTag.create({ data: { instansId: ib.id, navn: "Test Område", slug: "test-omraade" } });
  const krimi = await db.category.create({ data: { instansId: ia.id, navn: "Krimi og retsvæsen", slug: "krimi-og-retsvaesen" } });
  categoryKrimiId = krimi.id;
  await db.category.create({ data: { instansId: ia.id, navn: "Politik", slug: "politik" } });
  const ka = await createApiKey({ instansId: ia.id, name: "test A", scopes: ["signals:write", "articles:draft", "health:read"] });
  const kb = await createApiKey({ instansId: ib.id, name: "test B", scopes: ["signals:write", "articles:draft", "health:read"] });
  const ro = await createApiKey({ instansId: ia.id, name: "read only", scopes: ["health:read"] });
  const rv = await createApiKey({ instansId: ia.id, name: "revoked", scopes: ["signals:write"] });
  await db.apiKey.update({ where: { id: rv.id }, data: { revokedAt: new Date() } });
  a = { id: ia.id, key: ka.key, prefix: ka.prefix, keyId: ka.id };
  b = { id: ib.id, key: kb.key };
  readOnlyKey = ro.key;
  revokedKey = rv.key;
});

after(async () => {
  for (const id of createdInstances) {
    await db.signal.deleteMany({ where: { instansId: id } });
    await db.article.deleteMany({ where: { instansId: id } });
    await db.category.deleteMany({ where: { instansId: id } });
    await db.geoTag.deleteMany({ where: { instansId: id } });
    await db.apiKey.deleteMany({ where: { instansId: id } });
    await db.instance.delete({ where: { id } });
  }
});

test("auth: ingen/ugyldig/tilbagekaldt nøgle -> 401, manglende scope -> 403, gyldig -> bundet instans", async () => {
  assert.equal((await getHealth(req("/api/ingest/health", null, undefined, "GET"))).status, 401);
  assert.equal((await getHealth(req("/api/ingest/health", "lk_" + "x".repeat(43), undefined, "GET"))).status, 401);
  assert.equal((await getHealth(req("/api/ingest/health", "not-a-key-at-all-really-long-string", undefined, "GET"))).status, 401);
  assert.equal((await postSignals(req("/api/ingest/signals", revokedKey, signal()))).status, 401);
  assert.equal((await postSignals(req("/api/ingest/signals", readOnlyKey, signal()))).status, 403);
  assert.equal((await postArticles(req("/api/ingest/articles", readOnlyKey, article()))).status, 403);

  const ok = await getHealth(req("/api/ingest/health", a.key, undefined, "GET"));
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.instance.id, a.id);
  assert.equal(body.key.prefix, a.prefix);
  assert.ok(!JSON.stringify(body).includes(a.key), "klartekstnøglen returneres aldrig");
});

test("nøgler gemmes kun som sha256-hash; Bearer-parsing er striks", async () => {
  const row = await db.apiKey.findUnique({ where: { id: a.keyId } });
  assert.ok(row);
  assert.notEqual(row.hashedKey, a.key);
  assert.equal(row.hashedKey, hashApiKey(a.key));
  assert.equal(row.hashedKey.length, 64);
  assert.ok(a.key.startsWith("lk_") && a.key.length >= 40);
  assert.ok(a.key.startsWith(row.prefix));
  assert.equal(extractBearer(`Bearer ${a.key}`), a.key);
  assert.equal(extractBearer(`Basic ${a.key}`), null);
  assert.equal(extractBearer(null), null);
  assert.ok(row.lastUsedAt, "lastUsedAt opdateres ved brug");
});

test("signaler: oprettes som maskinindsamlet, dedupe på externalId og normaliseret kildeUrl, idempotent opdatering", async () => {
  const first = await postSignals(req("/api/ingest/signals", a.key, signal()));
  assert.equal(first.status, 201);
  const created = await first.json();
  assert.equal(created.status, "created");

  const row = await db.signal.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(row.maskinindsamlet, true);
  assert.equal(row.breaking, false);
  assert.equal(row.notable, false);
  assert.equal(row.instansId, a.id);
  assert.equal(row.sourceType, "kommune_dagsorden");
  assert.ok(!row.brødtekst?.includes("<script"), "HTML strippes");
  assert.equal(row.kildeUrlNorm, "https://naestved.dk/dagsorden/2026-10-01", "tracking-parametre fjernes i normaliseret URL");
  assert.ok(row.omraadeId, "geo matcher instansens egen GeoTag");
  assert.equal(row.ingestKeyId, a.keyId);

  const again = await (await postSignals(req("/api/ingest/signals", a.key, signal()))).json();
  assert.equal(again.status, "duplicate");
  assert.equal(again.id, created.id);
  assert.equal(again.duplicateOf, "externalId");

  const sameUrl = await (await postSignals(req("/api/ingest/signals", a.key, signal({ externalId: `sig-${run}-other`, kildeUrl: "http://www.naestved.dk/dagsorden/2026-10-01/#punkt4" })))).json();
  assert.equal(sameUrl.status, "duplicate");
  assert.equal(sameUrl.duplicateOf, "kildeUrl");
  assert.equal(sameUrl.id, created.id);
  assert.equal(await db.signal.count({ where: { instansId: a.id } }), 1);

  const updated = await (await postSignals(req("/api/ingest/signals", a.key, signal({ overskrift: "Byrådet udsætter ny lokalplan" })))).json();
  assert.equal(updated.status, "updated");
  assert.equal((await db.signal.findUniqueOrThrow({ where: { id: created.id } })).version, 2);
});

test("signaler: validering (strict, enum, URL, instansId, breaking) og batch", async () => {
  for (const bad of [
    signal({ sourceType: "ukendt" }),
    signal({ kildeUrl: "javascript:alert(1)" }),
    signal({ breaking: true }),
    signal({ externalId: "" }),
    signal({ publishedAt: "i går" }),
  ]) assert.equal((await postSignals(req("/api/ingest/signals", a.key, bad))).status, 400, JSON.stringify(bad).slice(0, 60));
  assert.equal((await postSignals(req("/api/ingest/signals", a.key, { ...signal(), instansId: b.id }))).status, 403);

  const batch = await postSignals(req("/api/ingest/signals", a.key, { signals: [
    signal({ externalId: `b1-${run}`, kildeUrl: "https://politi.dk/nyhed/1", sourceType: "politi" }),
    signal({ externalId: `b2-${run}`, kildeUrl: "https://politi.dk/nyhed/2", sourceType: "beredskab_112" }),
    signal({ externalId: `b1-${run}`, kildeUrl: "https://politi.dk/nyhed/1", sourceType: "politi" }),
  ] }));
  assert.equal(batch.status, 200);
  const body = await batch.json();
  assert.deepEqual(body.summary, { created: 2, updated: 0, duplicate: 1, rejected: 0 });
});

test("tenant-isolation: samme externalId/kildeUrl i anden instans er uafhængig; geo og data lækker ikke", async () => {
  const res = await (await postSignals(req("/api/ingest/signals", b.key, signal()))).json();
  assert.equal(res.status, "created", "instans B er ikke duplikat af instans A");
  const rowB = await db.signal.findUniqueOrThrow({ where: { id: res.id } });
  assert.equal(rowB.instansId, b.id);
  const geoB = await db.geoTag.findFirstOrThrow({ where: { instansId: b.id } });
  assert.equal(rowB.omraadeId, geoB.id, "geo slås op i B's egne GeoTags");
  assert.equal(await db.signal.count({ where: { instansId: a.id, id: res.id } }), 0);

  // Artikel-isolation
  const art = await (await postArticles(req("/api/ingest/articles", a.key, article()))).json();
  assert.equal(art.status, "created");
  const sameExternalInB = await (await postArticles(req("/api/ingest/articles", b.key, article()))).json();
  assert.equal(sameExternalInB.status, "created");
  assert.notEqual(sameExternalInB.id, art.id);
  assert.equal((await db.article.findUniqueOrThrow({ where: { id: sameExternalInB.id } })).instansId, b.id);
});

test("artikler: tvunget kladde, AI-assisteret, aldrig publiceret, escaped HTML, proveniens", async () => {
  const row = await db.article.findFirstOrThrow({ where: { instansId: a.id, externalId: `art-${run}-1` } });
  assert.equal(row.status, INGEST_DRAFT_STATUS);
  assert.equal(INGEST_DRAFT_STATUS, ARTICLE_STATUSES[0]);
  assert.equal(row.indholdstype, "AI-assisteret");
  assert.equal(row.publiceretTid, null);
  assert.deepEqual(row.aiBrug, ["Udkast"]);
  assert.equal(row.pinned, false);
  assert.equal(row.breaking, false);
  assert.equal(row.forfatterId, null);
  const blocks = row.blocks as Array<{ type: string; data: { content: string } }>;
  const html = blocks.map((x) => x.data.content).join("");
  assert.ok(!html.includes("<img") && !html.includes("onerror"), "tags fjernet");
  assert.ok(html.includes("<p>") && html.includes("&amp; mere"), "tekst er escaped og pakket i <p>");
  const prov = row.provenance as { kilder: Array<{ url: string; dato: string }>; ingestKeyPrefix: string };
  assert.equal(prov.kilder[0].url, "https://naestved.dk/dagsorden/2026-10-01");
  assert.equal(prov.ingestKeyPrefix, a.prefix);
  const marking = row.marking as { godkendtAf: string; kilder: string[] };
  assert.equal(marking.godkendtAf, "", "en redaktør skal godkende senere");
  assert.deepEqual(marking.kilder, ["https://naestved.dk/dagsorden/2026-10-01"]);

  // Idempotent
  const again = await postArticles(req("/api/ingest/articles", a.key, article({ titel: "Ændret titel af agenten" })));
  assert.equal(again.status, 200);
  assert.equal((await again.json()).status, "duplicate");
  assert.equal((await db.article.findFirstOrThrow({ where: { instansId: a.id, externalId: `art-${run}-1` } })).titel, "Ny lokalplan sendt i høring", "redaktørens version overskrives ikke");
  assert.equal(await db.article.count({ where: { instansId: a.id } }), 1);
});

test("artikler: status/publicering/indholdstype kan ikke sættes; aiBrug og kilder (url+dato) er påkrævet; citater kræver kilde+dato", async () => {
  const post = (body: unknown) => postArticles(req("/api/ingest/articles", a.key, body));
  const n = (s: string) => article({ externalId: `art-${run}-${s}` });

  for (const key of ["status", "publiceretTid", "pinned", "breaking", "marking", "instansId"]) {
    const res = await post({ ...n("x" + key), [key]: key === "status" ? "Publiceret" : key === "instansId" ? b.id : true });
    assert.equal(res.status, 422, key);
  }
  assert.equal((await post({ ...n("t"), indholdstype: "Uafhængig" })).status, 422);

  const noAi = { ...n("noai") } as Record<string, unknown>; delete noAi.aiBrug;
  assert.equal((await post(noAi)).status, 400);
  assert.equal((await post(n("emptyai") && { ...n("emptyai"), aiBrug: [] })).status, 400);
  assert.equal((await post({ ...n("badai"), aiBrug: ["Ingen"] })).status, 400);
  assert.equal((await post({ ...n("nosrc"), sources: [] })).status, 400);
  assert.equal((await post({ ...n("srcnodate"), sources: [{ url: "https://x.dk/a" }] })).status, 400);
  assert.equal((await post({ ...n("srcbadurl"), sources: [{ url: "javascript:1", dato: "2026-10-01" }] })).status, 400);
  assert.equal((await post({ ...n("nobody"), tekst: undefined })).status, 400);

  const quoteBad = await post({ ...n("qbad"), tekst: undefined, blocks: [{ type: "quote", quote: "Vi bygger", attribution: "Borgmester" }] });
  assert.equal(quoteBad.status, 400);
  const quoteNoDate = await post({ ...n("qnodate"), tekst: undefined, blocks: [{ type: "quote", quote: "Vi bygger", kildeUrl: "https://x.dk/q" }] });
  assert.equal(quoteNoDate.status, 400);
  const quoteOk = await post({ ...n("qok"), tekst: undefined, blocks: [{ type: "paragraph", text: "Intro" }, { type: "quote", quote: "Vi bygger", attribution: "Borgmester", kildeUrl: "https://x.dk/q", dato: "2026-09-30" }] });
  assert.equal(quoteOk.status, 201);
  assert.equal(await db.article.count({ where: { instansId: a.id, status: { not: INGEST_DRAFT_STATUS } } }), 0, "ingen artikel er andet end kladde");
});

test("artikler: Krimi/Sundhed og politi-/112-kilder er spærret; ukendt sektion afvises; gyldig sektion accepteres", async () => {
  const post = (body: unknown) => postArticles(req("/api/ingest/articles", a.key, body));
  assert.ok(categoryKrimiId);
  assert.equal((await post(article({ externalId: `art-${run}-krimi`, sektion: "krimi-og-retsvaesen" }))).status, 403);
  assert.equal((await post(article({ externalId: `art-${run}-pol`, sources: [{ url: "https://politi.dk/x", dato: "2026-10-01", sourceType: "politi" }] }))).status, 403);
  assert.equal((await post(article({ externalId: `art-${run}-112`, sources: [{ url: "https://112.dk/x", dato: "2026-10-01", sourceType: "beredskab_112" }] }))).status, 403);
  assert.equal((await post(article({ externalId: `art-${run}-unk`, sektion: "findes-ikke" }))).status, 422);
  assert.equal((await post(article({ externalId: `art-${run}-ok`, sektion: "politik", omraader: ["test-omraade"] }))).status, 201);
  assert.equal(await db.article.count({ where: { instansId: a.id, externalId: { in: [`art-${run}-krimi`, `art-${run}-pol`, `art-${run}-112`] } } }), 0);
  const ok = await db.article.findFirstOrThrow({ where: { instansId: a.id, externalId: `art-${run}-ok` }, include: { geoTags: true, kategori: true } });
  assert.equal(ok.kategori?.slug, "politik");
  assert.equal(ok.geoTags.length, 1);
});

test("rate limit: 120 kald/min pr. nøgle, derefter 429 med Retry-After", async () => {
  setRateLimitStore(new MemoryRateLimitStore());
  const k = await createApiKey({ instansId: a.id, name: "rl", scopes: ["health:read"] });
  let last: Response | null = null;
  for (let i = 0; i < 121; i++) last = await getHealth(req("/api/ingest/health", k.key, undefined, "GET"));
  assert.equal(last?.status, 429);
  assert.ok(Number(last?.headers.get("retry-after")) >= 1);
  // Fejlede forsøg pr. IP begrænses også
  setRateLimitStore(new MemoryRateLimitStore());
  let status = 0;
  for (let i = 0; i < 32; i++) status = (await getHealth(req("/api/ingest/health", "lk_" + "y".repeat(43), undefined, "GET"))).status;
  assert.equal(status, 429);
});
