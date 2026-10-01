import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { recordAdEvent, recordMetricEvent, MAX_SECONDS_PER_CALL } from "../lib/tracking";
import { findPublicArticle, findPublicArticles, publicMarking } from "../lib/public-api";
import { setRateLimitStore, MemoryRateLimitStore } from "../lib/ratelimit";

const run = Date.now().toString(36);
const ids: string[] = [];
let A: string, B: string;
let campaignA: string, campaignCap: string, campaignPaused: string, campaignExpired: string;
let articleA: string, articleDraftA: string, articleB: string;

before(async () => {
  setRateLimitStore(new MemoryRateLimitStore());
  const mk = async (s: string) => {
    const i = await db.instance.create({ data: { navn: `Trk${s}${run}`, domaene: `trk-${s}-${run}.test`, geografiskDækning: [], kategoriTaksonomi: [], markingTekster: {} } });
    ids.push(i.id);
    return i.id;
  };
  A = await mk("a");
  B = await mk("b");
  const now = Date.now();
  const camp = (instansId: string, over: Record<string, unknown> = {}) =>
    db.adCampaign.create({ data: { instansId, titel: "t", annoncoer: "x", format: "IN_FEED_BANNER", status: "Aktiv", startDato: new Date(now - 86_400_000), slutDato: new Date(now + 86_400_000), kreativData: {}, ...over } });
  campaignA = (await camp(A)).id;
  campaignCap = (await camp(A, { maksVisninger: 1 })).id;
  campaignPaused = (await camp(A, { status: "Pause" })).id;
  campaignExpired = (await camp(A, { slutDato: new Date(now - 1000) })).id;
  const art = (instansId: string, over: Record<string, unknown> = {}) =>
    db.article.create({ data: { titel: "T", slug: `trk-${run}-${Math.random().toString(36).slice(2)}`, blocks: [], aiBrug: ["Ingen"], status: "Publiceret", publiceretTid: new Date(), instansId, ...over } });
  articleA = (await art(A, { marking: { sponsor: "Bager", labelTekst: "Sponsoreret", oprindeligKontakt: "hemmelig@privat.dk", aftaleId: "x", godkendtAf: "intern" } })).id;
  articleDraftA = (await art(A, { status: "Idé", publiceretTid: null })).id;
  articleB = (await art(B)).id;
});

after(async () => {
  for (const id of ids) {
    await db.articleMetric.deleteMany({ where: { instansId: id } });
    await db.article.deleteMany({ where: { instansId: id } });
    await db.adCampaign.deleteMany({ where: { instansId: id } });
    await db.instance.delete({ where: { id } });
  }
});

test("ads: kampagne fra anden instans afvises (tenant-binding), inaktive/udløbne kampagner tælles ikke", async () => {
  assert.deepEqual(await recordAdEvent({ siteId: B, campaignId: campaignA, type: "impression", visitor: "v1" }), { notFound: true });
  assert.deepEqual(await recordAdEvent({ siteId: A, campaignId: campaignPaused, type: "impression", visitor: "v1" }), { notFound: true });
  assert.deepEqual(await recordAdEvent({ siteId: A, campaignId: campaignExpired, type: "impression", visitor: "v1" }), { notFound: true });
  assert.deepEqual(await recordAdEvent({ siteId: A, campaignId: "findes-ikke-1234", type: "click", visitor: "v1" }), { notFound: true });
  assert.equal((await db.adCampaign.findUniqueOrThrow({ where: { id: campaignA } })).visninger, 0);
});

test("ads: visning og klik dedupes pr. besøgende; flere besøgende tælles; maksVisninger respekteres", async () => {
  assert.deepEqual(await recordAdEvent({ siteId: A, campaignId: campaignA, type: "impression", visitor: "v1" }), { counted: true });
  assert.deepEqual(await recordAdEvent({ siteId: A, campaignId: campaignA, type: "impression", visitor: "v1" }), { counted: false, reason: "duplicate" });
  assert.deepEqual(await recordAdEvent({ siteId: A, campaignId: campaignA, type: "impression", visitor: "v2" }), { counted: true });
  assert.deepEqual(await recordAdEvent({ siteId: A, campaignId: campaignA, type: "click", visitor: "v1" }), { counted: true });
  for (let i = 0; i < 20; i++) await recordAdEvent({ siteId: A, campaignId: campaignA, type: "click", visitor: "v1" });
  const c = await db.adCampaign.findUniqueOrThrow({ where: { id: campaignA } });
  assert.equal(c.visninger, 2);
  assert.equal(c.klik, 1, "gentagne klik fra samme besøgende tælles ikke");

  assert.deepEqual(await recordAdEvent({ siteId: A, campaignId: campaignCap, type: "impression", visitor: "x1" }), { counted: true });
  assert.deepEqual(await recordAdEvent({ siteId: A, campaignId: campaignCap, type: "impression", visitor: "x2" }), { counted: false, reason: "cap" });
});

test("metrics: artikel fra anden instans eller ikke-publiceret afvises", async () => {
  const base = { isNewView: true, secondsSpent: 5, reached75: false, visitor: "m1" };
  assert.deepEqual(await recordMetricEvent({ siteId: B, articleId: articleA, ...base }), { notFound: true });
  assert.deepEqual(await recordMetricEvent({ siteId: A, articleId: articleB, ...base }), { notFound: true });
  assert.deepEqual(await recordMetricEvent({ siteId: A, articleId: articleDraftA, ...base }), { notFound: true });
  assert.equal(await db.articleMetric.count({ where: { articleId: { in: [articleA, articleB, articleDraftA] } } }), 0);
});

test("metrics: visning dedupes, tid kappes pr. kald, læsning tælles højst én gang og aldrig over visninger", async () => {
  const r1 = await recordMetricEvent({ siteId: A, articleId: articleA, isNewView: true, secondsSpent: 0, reached75: false, visitor: "m1" });
  assert.equal(("counted" in r1) && r1.counted, true);
  const dup = await recordMetricEvent({ siteId: A, articleId: articleA, isNewView: true, secondsSpent: 0, reached75: false, visitor: "m1" });
  assert.deepEqual(dup, { counted: false, reason: "duplicate" });

  await recordMetricEvent({ siteId: A, articleId: articleA, isNewView: false, secondsSpent: 99_999, reached75: true, visitor: "m1" });
  await recordMetricEvent({ siteId: A, articleId: articleA, isNewView: false, secondsSpent: 0, reached75: true, visitor: "m1" });
  const m = await db.articleMetric.findUniqueOrThrow({ where: { articleId: articleA } });
  assert.equal(m.visninger, 1);
  assert.equal(m.laesninger, 1);
  assert.equal(m.totalLaesetidSek, MAX_SECONDS_PER_CALL);

  // En besøgende der aldrig har set artiklen (ingen visning) kan ikke skabe flere læsninger end visninger
  await recordMetricEvent({ siteId: A, articleId: articleA, isNewView: false, secondsSpent: 1, reached75: true, visitor: "m2" });
  await recordMetricEvent({ siteId: A, articleId: articleA, isNewView: false, secondsSpent: 1, reached75: true, visitor: "m3" });
  const m2 = await db.articleMetric.findUniqueOrThrow({ where: { articleId: articleA } });
  assert.ok(m2.laesninger <= m2.visninger);
});

test("metrics: pr.-besøgende kaldsloft (40/time) stopper pumpning", async () => {
  let rateLimited = 0;
  for (let i = 0; i < 60; i++) {
    const r = await recordMetricEvent({ siteId: A, articleId: articleA, isNewView: false, secondsSpent: 5, reached75: false, visitor: "pump" });
    if ("reason" in r && r.reason === "rate") rateLimited++;
  }
  assert.ok(rateLimited >= 20);
});

test("offentligt API: kun egen instans + Publiceret; marking afslører ingen interne/personlige felter", async () => {
  const listA = await findPublicArticles(A, { limit: 50 });
  const listB = await findPublicArticles(B, { limit: 50 });
  assert.equal(listA.length, 1, "kun den publicerede artikel i A (ikke kladden, ikke B's)");
  assert.equal(listB.length, 1);
  assert.notEqual(listA[0].id, listB[0].id);
  assert.equal(listA[0].id, articleA);

  const slugA = listA[0].slug;
  assert.ok(await findPublicArticle(A, slugA));
  assert.equal(await findPublicArticle(B, slugA), null, "slug fra anden by -> ikke fundet");

  const json = JSON.stringify(listA[0]);
  assert.ok(!json.includes("hemmelig@privat.dk"));
  assert.ok(!json.includes("oprindeligKontakt") && !json.includes("aftaleId") && !json.includes("godkendtAf"));
  assert.deepEqual(listA[0].marking, { sponsor: "Bager", labelTekst: "Sponsoreret" });
  assert.equal(listA[0].aiBrugt, false);
  assert.equal(publicMarking(null), null);
  assert.equal(publicMarking("streng"), null);
});
