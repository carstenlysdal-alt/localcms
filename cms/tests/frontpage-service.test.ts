import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { PERMISSIONS } from "../lib/permissions";
import { MemoryRateLimitStore, setRateLimitStore } from "../lib/ratelimit";
import type { AiTextClient } from "../lib/frontpage/ai-client";
import {
  approveSnapshot,
  createProposal,
  editSnapshot,
  getSlotMetrics,
  getSnapshot,
  interpretEditorCommand,
  listLayoutVersions,
  loadCandidates,
  publishLayout,
  recordSlotEvent,
  rejectSnapshot,
  resolveFrontpageForRender,
  rollbackLayout,
  saveDraftLayout,
  type FrontpageUser,
} from "../lib/frontpage/service";
import { defaultLayoutModules } from "../lib/frontpage/templates";
import { GET as cronGet, POST as cronPost } from "../app/api/cron/frontpage-rank/route";

const run = Date.now().toString(36);
const created: string[] = [];
let A: string;
let B: string;
const articleIds: string[] = [];
let partnerId: string;
let draftArticleId: string;

const P = PERMISSIONS;
const user = (instansId: string, permissions: string[], id = `user-${instansId}`): FrontpageUser => ({ id, name: "Test Redaktør", instansId, permissions });
const FULL = [P.FRONTPAGE_EDIT, P.FRONTPAGE_LAYOUT_MANAGE, P.FRONTPAGE_SNAPSHOT_APPROVE, P.FRONTPAGE_AI_USE];

/** Fake Claude: giver prioritet 5 til den ældste (laveste deterministiske) af de angivne artikler. */
function aiFor(ids: string[]): AiTextClient {
  return async () => ({
    text: JSON.stringify({ forslag: ids.map((id, i) => ({ articleId: id, prioritet: 5 - i, forslagModul: "hero", begrundelse: `Fake-begrundelse ${i}`, konfidens: 0.9 })) }),
    modelId: "fake-sonnet",
  });
}
/** AI nedtoner den deterministiske nr. 1 og løfter nr. 2 (+ et kommercielt forslag til hero som skal ignoreres). */
function aiReorder(first: string, second: string, partner: string): AiTextClient {
  return async () => ({
    text: JSON.stringify({
      forslag: [
        { articleId: second, prioritet: 5, forslagModul: "hero", begrundelse: "Fake-begrundelse: stor lokal konsekvens.", konfidens: 0.9 },
        { articleId: first, prioritet: 1, forslagModul: "seneste-nyt", begrundelse: "Fake-begrundelse: lav nyhedsværdi.", konfidens: 0.9 },
        { articleId: partner, prioritet: 5, forslagModul: "hero", begrundelse: "Fake-begrundelse: skal i toppen", konfidens: 1 },
      ],
    }),
    modelId: "fake-sonnet",
  });
}
const failingAi: AiTextClient = async () => {
  throw Object.assign(new Error("overloaded"), { status: 529 });
};

before(async () => {
  setRateLimitStore(new MemoryRateLimitStore());
  const mk = async (s: string) => {
    const inst = await db.instance.create({ data: { navn: `FrontpageTest${s}${run}`, domaene: `fp-${s}-${run}.test`, geografiskDækning: [], kategoriTaksonomi: [], markingTekster: {}, kvoteloftProcent: 25 } });
    created.push(inst.id);
    return inst.id;
  };
  A = await mk("a");
  B = await mk("b");
  const now = Date.now();
  const mkArticle = async (instansId: string, i: number, over: Record<string, unknown> = {}) =>
    db.article.create({
      data: {
        instansId,
        titel: `Test ${i} ${run}`,
        slug: `fp-${run}-${instansId.slice(-6)}-${i}`,
        blocks: [],
        aiBrug: [],
        status: "Publiceret",
        publiceretTid: new Date(now - (i + 1) * 3_600_000),
        metric: { create: { instansId, visninger: 1000 - i * 60, laesninger: 400 - i * 20, totalLaesetidSek: 9000 } },
        ...over,
      },
    });
  for (let i = 0; i < 12; i++) articleIds.push((await mkArticle(A, i)).id);
  partnerId = (await mkArticle(A, 20, { indholdstype: "Partner", marking: { sponsor: "Fjordbyg A/S", labelTekst: "Partner: Fjordbyg A/S", aftaleId: "sa-test" } })).id;
  draftArticleId = (await mkArticle(A, 21, { status: "Kladde", publiceretTid: null })).id;
  await mkArticle(B, 0);
});

after(async () => {
  for (const id of created) {
    await db.frontpageSlotMetric.deleteMany({ where: { instansId: id } });
    await db.frontpageDecision.deleteMany({ where: { instansId: id } });
    await db.frontpageSnapshot.deleteMany({ where: { instansId: id } });
    await db.frontpageLayoutVersion.deleteMany({ where: { instansId: id } });
    await db.frontpageLayout.deleteMany({ where: { instansId: id } });
    await db.frontpagePlacement.deleteMany({ where: { instansId: id } });
    await db.article.deleteMany({ where: { instansId: id } });
    await db.instance.delete({ where: { id } });
  }
});

test("loadCandidates: kun publicerede artikler fra egen instans, med mærkning udledt af marking", async () => {
  const c = await loadCandidates(A);
  assert.ok(c.every((x) => x.instansId === A && x.status === "Publiceret"));
  assert.ok(!c.some((x) => x.id === draftArticleId));
  const partner = c.find((x) => x.id === partnerId);
  assert.equal(partner?.harMaerkning, true);
  assert.equal(partner?.maerkningTekst, "Partner: Fjordbyg A/S");
  assert.ok((await loadCandidates(B)).every((x) => x.instansId === B));
});

test("createProposal: rettigheder og tenant — uden rettighed forbudt, fremmed instans 'findes ikke'", async () => {
  const none = await createProposal(A, { actor: { kind: "user", user: user(A, []) }, useAi: false });
  assert.deepEqual([none.ok, !none.ok && none.code], [false, "forbidden"]);
  const noAi = await createProposal(A, { actor: { kind: "user", user: user(A, [P.FRONTPAGE_EDIT]) }, useAi: true, aiClient: aiFor(articleIds) });
  assert.deepEqual([noAi.ok, !noAi.ok && noAi.code], [false, "forbidden"]);
  const foreign = await createProposal(A, { actor: { kind: "user", user: user(B, FULL) }, useAi: false });
  assert.deepEqual([foreign.ok, !foreign.ok && foreign.code], [false, "not-found"]);
  assert.equal(await db.frontpageSnapshot.count({ where: { instansId: A } }), 0);
});

test("createProposal (cron) med AI-fejl: deterministisk forslag gemmes som 'forslag', intet publiceres, forsiden bruger fallback", async () => {
  const res = await createProposal(A, { actor: { kind: "cron" }, useAi: true, aiClient: failingAi, aiRetries: 0 });
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.generatedBy, "deterministic");
  assert.equal(res.aiFailure?.reason, "api-fejl");
  assert.ok(res.warnings.some((w) => w.code === "ai-fejl"));
  const snap = await db.frontpageSnapshot.findUnique({ where: { id: res.snapshotId } });
  assert.equal(snap?.status, "forslag");
  assert.equal(snap?.instansId, A);
  assert.equal(snap?.mode, "forslag");
  assert.equal(snap?.expiresAt, null);
  assert.ok((await db.frontpageDecision.count({ where: { snapshotId: res.snapshotId, handling: "placeret" } })) > 0);

  const render = await resolveFrontpageForRender(A);
  assert.equal(render.resolved.source, "deterministisk", "uden godkendelse vises deterministisk score, ikke forslaget");
  assert.equal(render.resolved.snapshotId, null);
  assert.ok(render.resolved.assignments.length > 0);
  assert.ok(!render.resolved.assignments.some((a) => a.articleId === draftArticleId));
});

test("createProposal (AI): forslag med kilde 'ai', modelId og begrundelser; AI kan ikke placere kommercielt i hero", async () => {
  const res = await createProposal(A, { actor: { kind: "user", user: user(A, FULL) }, useAi: true, aiClient: aiReorder(articleIds[0], articleIds[1], partnerId) });
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.generatedBy, "ai");
  assert.equal(res.modelId, "fake-sonnet");
  assert.equal(res.reused, false);
  const full = await getSnapshot(user(A, FULL), res.snapshotId);
  assert.ok(full);
  const hero = full.items.assignments.find((a) => a.moduleId === "hero");
  assert.equal(hero?.articleId, articleIds[1]);
  assert.equal(hero?.kilde, "ai");
  assert.match(hero?.begrundelse ?? "", /Fake-begrundelse/);
  const partnerSlot = full.items.assignments.find((a) => a.articleId === partnerId);
  assert.equal(partnerSlot, undefined, "ingen partnerboks i standardlayoutet; og aldrig i hero");
  assert.ok(full.decisions.length > 0);
  // Den tidligere forslag er nu udløbet (kun ét aktivt forslag).
  assert.equal(await db.frontpageSnapshot.count({ where: { instansId: A, status: "forslag" } }), 1);
});

test("createProposal: uændret input genbruger eksisterende forslag (ingen støj); force opretter nyt", async () => {
  const again = await createProposal(A, { actor: { kind: "user", user: user(A, FULL) }, useAi: true, aiClient: aiReorder(articleIds[0], articleIds[1], partnerId) });
  assert.ok(again.ok && again.reused);
  const forced = await createProposal(A, { actor: { kind: "user", user: user(A, FULL) }, useAi: true, aiClient: aiFor([articleIds[5]]), force: true });
  assert.ok(forced.ok && !forced.reused);
});

test("approveSnapshot: kræver rettighed; tenant-isolation; derefter vises den godkendte forside", async () => {
  const list = await db.frontpageSnapshot.findFirst({ where: { instansId: A, status: "forslag" } });
  assert.ok(list);
  const snapId = list.id;

  const noPerm = await approveSnapshot(user(A, [P.FRONTPAGE_EDIT, P.FRONTPAGE_AI_USE]), snapId);
  assert.deepEqual([noPerm.ok, !noPerm.ok && noPerm.code], [false, "forbidden"]);
  const foreign = await approveSnapshot(user(B, FULL), snapId);
  assert.deepEqual([foreign.ok, !foreign.ok && foreign.code], [false, "not-found"]);
  assert.equal((await db.frontpageSnapshot.findUnique({ where: { id: snapId } }))?.status, "forslag", "uændret efter afviste forsøg");
  const foreignReject = await rejectSnapshot(user(B, FULL), snapId, "nej");
  assert.deepEqual([foreignReject.ok, !foreignReject.ok && foreignReject.code], [false, "not-found"]);
  assert.equal(await getSnapshot(user(B, FULL), snapId), null);

  const ok = await approveSnapshot(user(A, FULL, "godkender-1"), snapId);
  assert.ok(ok.ok);
  const row = await db.frontpageSnapshot.findUnique({ where: { id: snapId } });
  assert.equal(row?.status, "godkendt");
  assert.equal(row?.godkendtAf, "godkender-1");
  assert.ok(row?.godkendtTid && row.expiresAt && row.expiresAt.getTime() > Date.now());

  const render = await resolveFrontpageForRender(A);
  assert.equal(render.resolved.source, "godkendt-snapshot");
  assert.equal(render.resolved.snapshotId, snapId);

  const twice = await approveSnapshot(user(A, FULL), snapId);
  assert.deepEqual([twice.ok, !twice.ok && twice.code], [false, "conflict"]);
  const rejectApproved = await rejectSnapshot(user(A, FULL), snapId);
  assert.deepEqual([rejectApproved.ok, !rejectApproved.ok && rejectApproved.code], [false, "conflict"]);
  assert.ok(await db.frontpageDecision.findFirst({ where: { snapshotId: snapId, handling: "godkendt", kilde: "redaktør" } }));
});

test("godkendt forside overlever at en artikel afpubliceres: placeringen repareres og forsiden går ikke ned", async () => {
  const approved = await db.frontpageSnapshot.findFirst({ where: { instansId: A, status: "godkendt" } });
  const items = approved?.items as { assignments: Array<{ articleId: string }> };
  const victim = items.assignments[2].articleId;
  await db.article.update({ where: { id: victim }, data: { status: "Afpubliceret" } });
  try {
    const render = await resolveFrontpageForRender(A);
    assert.equal(render.resolved.source, "godkendt-snapshot");
    assert.equal(render.resolved.repaired, 1);
    assert.ok(!render.resolved.assignments.some((a) => a.articleId === victim));
  } finally {
    await db.article.update({ where: { id: victim }, data: { status: "Publiceret" } });
  }
});

test("approveSnapshot afviser forslag hvis artikler er afpubliceret siden forslaget (rækværk ved godkendelse)", async () => {
  const p = await createProposal(A, { actor: { kind: "cron" }, useAi: false, force: true });
  assert.ok(p.ok);
  if (!p.ok) return;
  const snap = await db.frontpageSnapshot.findUnique({ where: { id: p.snapshotId } });
  const victim = (snap?.items as { assignments: Array<{ articleId: string }> }).assignments[0].articleId;
  await db.article.update({ where: { id: victim }, data: { status: "Kladde" } });
  try {
    const res = await approveSnapshot(user(A, FULL), p.snapshotId);
    assert.deepEqual([res.ok, !res.ok && res.code], [false, "guardrails"]);
    if (!res.ok) assert.ok(res.violations?.some((v) => v.code === "status" || v.code === "ukendt-artikel"));
    assert.equal((await db.frontpageSnapshot.findUnique({ where: { id: p.snapshotId } }))?.status, "forslag");
  } finally {
    await db.article.update({ where: { id: victim }, data: { status: "Publiceret" } });
  }
});

test("rejectSnapshot og editSnapshot: afvis gemmer årsag; redigering valideres og logges som redaktør", async () => {
  const p = await createProposal(A, { actor: { kind: "cron" }, useAi: false, force: true });
  assert.ok(p.ok);
  if (!p.ok) return;
  const full = await getSnapshot(user(A, FULL), p.snapshotId);
  assert.ok(full);
  const list = full.items.assignments;

  // Byt hero og første grid-slot: gyldigt.
  const swapped = list.map((a) => (a.moduleId === "hero" ? { ...a, articleId: list.find((x) => x.moduleId === "top-grid" && x.slotIndex === 0)!.articleId } : a.moduleId === "top-grid" && a.slotIndex === 0 ? { ...a, articleId: list.find((x) => x.moduleId === "hero")!.articleId } : a));
  const edited = await editSnapshot(user(A, FULL, "red-1"), p.snapshotId, swapped);
  assert.ok(edited.ok);
  if (edited.ok) {
    const hero = edited.items.assignments.find((a) => a.moduleId === "hero");
    assert.equal(hero?.kilde, "redaktør");
    assert.equal(hero?.locked, true);
  }
  assert.ok(await db.frontpageDecision.findFirst({ where: { snapshotId: p.snapshotId, handling: "redigeret", kilde: "redaktør" } }));

  // Ugyldigt: kladde-artikel i hero, og manipuleret label/ekstra felter afvises.
  const withDraft = list.map((a) => (a.moduleId === "hero" ? { ...a, articleId: draftArticleId } : a));
  const bad = await editSnapshot(user(A, FULL), p.snapshotId, withDraft);
  assert.deepEqual([bad.ok, !bad.ok && bad.code], [false, "guardrails"]);
  const shape = await editSnapshot(user(A, FULL), p.snapshotId, list.map((a) => ({ ...a, hideLabel: true })));
  assert.deepEqual([shape.ok, !shape.ok && shape.code], [false, "invalid"]);
  const noPerm = await editSnapshot(user(A, [P.FRONTPAGE_EDIT]), p.snapshotId, list);
  assert.deepEqual([noPerm.ok, !noPerm.ok && noPerm.code], [false, "forbidden"]);

  const rej = await rejectSnapshot(user(A, FULL, "red-1"), p.snapshotId, "Passer ikke til i dag");
  assert.ok(rej.ok);
  const row = await db.frontpageSnapshot.findUnique({ where: { id: p.snapshotId } });
  assert.deepEqual([row?.status, row?.afvistAf, row?.afvistGrund], ["afvist", "red-1", "Passer ikke til i dag"]);
});

test("layout: kladde -> publicér -> versionshistorik -> rollback; samtidig redigering giver konflikt; tenant og rettigheder", async () => {
  const modules = defaultLayoutModules();
  const denied = await saveDraftLayout(user(A, [P.FRONTPAGE_EDIT]), { name: "Forside", modules });
  assert.deepEqual([denied.ok, !denied.ok && denied.code], [false, "forbidden"]);
  const invalid = await saveDraftLayout(user(A, FULL), { name: "Forside", modules: [{ id: "hero", type: "hero", slots: 1, hideLabel: true }] });
  assert.deepEqual([invalid.ok, !invalid.ok && invalid.code], [false, "invalid"]);

  const d = await saveDraftLayout(user(A, FULL), { name: "Forside", modules });
  assert.ok(d.ok);
  if (!d.ok) return;
  assert.equal(d.version, 1);
  // To redaktører åbner samme kladde: den anden gemmer med forældet version -> konflikt.
  const first = await saveDraftLayout(user(A, FULL), { draftId: d.draftId, name: "Forside v2", modules, expectedVersion: 1 });
  assert.ok(first.ok);
  const stale = await saveDraftLayout(user(A, FULL), { draftId: d.draftId, name: "Forside v2b", modules, expectedVersion: 1 });
  assert.deepEqual([stale.ok, !stale.ok && stale.code], [false, "conflict"]);
  // Fremmed tenant kan hverken gemme på eller publicere kladden.
  const foreignSave = await saveDraftLayout(user(B, FULL), { draftId: d.draftId, name: "x", modules, expectedVersion: 2 });
  assert.deepEqual([foreignSave.ok, !foreignSave.ok && foreignSave.code], [false, "not-found"]);
  const foreignPublish = await publishLayout(user(B, FULL), d.draftId);
  assert.deepEqual([foreignPublish.ok, !foreignPublish.ok && foreignPublish.code], [false, "not-found"]);
  const noPublish = await publishLayout(user(A, [P.FRONTPAGE_EDIT, P.FRONTPAGE_SNAPSHOT_APPROVE]), d.draftId);
  assert.deepEqual([noPublish.ok, !noPublish.ok && noPublish.code], [false, "forbidden"]);

  // Forslag lavet FØR publicering kan ikke godkendes bagefter (layoutet er ændret).
  const pre = await createProposal(A, { actor: { kind: "cron" }, useAi: false, force: true });
  assert.ok(pre.ok);

  const pub1 = await publishLayout(user(A, FULL), d.draftId);
  assert.ok(pub1.ok);
  if (!pub1.ok) return;
  assert.equal(pub1.version, 1);
  if (pre.ok) {
    const stalePre = await approveSnapshot(user(A, FULL), pre.snapshotId);
    assert.deepEqual([stalePre.ok, !stalePre.ok && stalePre.code], [false, "layout-aendret"]);
  }
  // Det tidligere godkendte snapshot hører til standardlayoutet og vises ikke længere: deterministisk fallback.
  assert.equal((await resolveFrontpageForRender(A)).resolved.source, "deterministisk");

  // Ny version: top-grid med 4 slots.
  const wider = modules.map((m) => (m.type === "top-grid" ? { ...m, slots: 4 } : m));
  const upd = await saveDraftLayout(user(A, FULL), { draftId: d.draftId, name: "Forside 4 grid", modules: wider, expectedVersion: 2 });
  assert.ok(upd.ok);
  const pub2 = await publishLayout(user(A, FULL), d.draftId);
  assert.ok(pub2.ok && pub2.version === 2);
  assert.equal((await resolveFrontpageForRender(A)).layout.modules.find((m) => m.type === "top-grid")?.slots, 4);

  const versions = await listLayoutVersions(user(A, FULL));
  assert.deepEqual(versions.map((v) => v.version), [2, 1]);
  assert.deepEqual(await listLayoutVersions(user(B, FULL)), [], "intet at se for en anden instans");

  const noRb = await rollbackLayout(user(A, [P.FRONTPAGE_EDIT]), 1);
  assert.deepEqual([noRb.ok, !noRb.ok && noRb.code], [false, "forbidden"]);
  const missing = await rollbackLayout(user(A, FULL), 99);
  assert.deepEqual([missing.ok, !missing.ok && missing.code], [false, "not-found"]);
  const rb = await rollbackLayout(user(A, FULL), 1);
  assert.ok(rb.ok && rb.version === 3);
  assert.equal((await resolveFrontpageForRender(A)).layout.modules.find((m) => m.type === "top-grid")?.slots, 3);
  assert.equal((await listLayoutVersions(user(A, FULL))).length, 3, "historikken bevares ved rollback");
  assert.equal(await db.frontpageLayout.count({ where: { instansId: A, status: "live" } }), 1);
  assert.equal(await db.frontpageLayout.count({ where: { instansId: B } }), 0);
});

test("recordSlotEvent: tenant-binding (fremmed artikel afvises), validering og CTR pr. slot", async () => {
  const bArticle = await db.article.findFirst({ where: { instansId: B } });
  assert.ok(bArticle);
  const foreign = await recordSlotEvent({ instansId: A, moduleId: "hero", slotKey: "0", articleId: bArticle.id, type: "impression" });
  assert.deepEqual(foreign, { ok: false, reason: "not-found" });
  const draft = await recordSlotEvent({ instansId: A, moduleId: "hero", slotKey: "0", articleId: draftArticleId, type: "impression" });
  assert.deepEqual(draft, { ok: false, reason: "not-found" });
  assert.deepEqual(await recordSlotEvent({ instansId: A, moduleId: "Hero!", slotKey: "0", articleId: articleIds[0], type: "click" }), { ok: false, reason: "invalid" });
  assert.deepEqual(await recordSlotEvent({ instansId: A, moduleId: "hero", slotKey: "x", articleId: articleIds[0], type: "click" }), { ok: false, reason: "invalid" });

  for (let i = 0; i < 4; i++) assert.ok((await recordSlotEvent({ instansId: A, moduleId: "hero", slotKey: "0", articleId: articleIds[0], type: "impression" })).ok);
  assert.ok((await recordSlotEvent({ instansId: A, moduleId: "hero", slotKey: "0", articleId: articleIds[0], type: "click" })).ok);
  const stats = await getSlotMetrics(user(A, [P.FRONTPAGE_EDIT]));
  assert.deepEqual(stats, [{ moduleId: "hero", slotKey: "0", impressions: 4, clicks: 1, ctr: 0.25 }]);
  assert.deepEqual(await getSlotMetrics(user(B, [P.FRONTPAGE_EDIT])), []);
  assert.deepEqual(await getSlotMetrics(user(A, []), {}), []);
});

test("interpretEditorCommand: kræver AI- og layout-rettighed; returnerer foreslåede operationer og logger handlingen", async () => {
  const modules = defaultLayoutModules();
  const client: AiTextClient = async () => ({
    text: JSON.stringify({ operationer: [{ op: "set_slots", moduleId: "top-grid", slots: 4 }, { op: "publish_layout" }], forklaring: "Fire i griddet." }),
    modelId: "fake",
  });
  const denied = await interpretEditorCommand(user(A, [P.FRONTPAGE_EDIT]), "gør griddet større", modules, { client });
  assert.deepEqual([denied.ok, "code" in denied && denied.code], [false, "forbidden"]);
  const none = await interpretEditorCommand(user(A, FULL), "gør griddet større", modules, { client: null });
  assert.deepEqual([none.ok, "code" in none && none.code], [false, "ai-unavailable"]);
  const invalid = await interpretEditorCommand(user(A, FULL), "gør griddet større", [{ id: "x", type: "hero", slots: 1, hideLabel: true }], { client });
  assert.deepEqual([invalid.ok, "code" in invalid && invalid.code], [false, "invalid"]);

  const res = await interpretEditorCommand(user(A, FULL), "gør griddet større", modules, { client });
  assert.ok(res.ok);
  if (res.ok) {
    assert.equal(res.ops.length, 1);
    assert.equal(res.rejected.length, 1);
    assert.ok(res.candidateIds.includes(articleIds[0]));
  }
  const log = await db.frontpageDecision.findFirst({ where: { instansId: A, handling: "nl-kommando" } });
  assert.equal(log?.kilde, "ai");
  assert.equal(log?.snapshotId, null);
});

// ── Cron-route ──────────────────────────────────────────────────────────────

const SECRET = "test-cron-secret-0123456789abcdef";
function cronReq(path: string, token: string | null, ip = "203.0.113.50", method = "GET") {
  return new Request(`http://test.local/api/cron/frontpage-rank${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "x-forwarded-for": ip } });
}

test("cron: uden CRON_SECRET afvises alt (503); forkert/manglende token 401 med konstant-tids-tjek; rate limit på fejl", async () => {
  const saved = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await cronGet(cronReq("", SECRET))).status, 503);
    process.env.CRON_SECRET = "kort";
    assert.equal((await cronGet(cronReq("", "kort"))).status, 503, "for kort hemmelighed accepteres ikke");

    process.env.CRON_SECRET = SECRET;
    assert.equal((await cronGet(cronReq("", null))).status, 401);
    assert.equal((await cronGet(cronReq("", "forkert-token"))).status, 401);
    assert.equal((await cronGet(cronReq("", SECRET.slice(0, -1)))).status, 401);
    assert.equal((await cronPost(cronReq("", SECRET + "x", "203.0.113.50", "POST"))).status, 401);
    const bad = await cronGet(cronReq("", "forkert-token"));
    assert.equal(bad.headers.get("www-authenticate"), 'Bearer realm="cron"');
    assert.ok(!(await bad.text()).includes(SECRET));

    let last = 0;
    for (let i = 0; i < 25; i++) last = (await cronGet(cronReq("", "forkert", "203.0.113.99"))).status;
    assert.equal(last, 429, "mange mislykkede forsøg rate-limites pr. IP");
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved;
  }
});

test("cron: gyldig token opretter kun FORSLAG for den angivne instans og publicerer aldrig", async () => {
  const saved = { s: process.env.CRON_SECRET, k: process.env.ANTHROPIC_API_KEY };
  try {
    process.env.CRON_SECRET = SECRET;
    delete process.env.ANTHROPIC_API_KEY;
    const approvedBefore = await db.frontpageSnapshot.count({ where: { instansId: A, status: "godkendt" } });
    const res = await cronGet(cronReq(`?instans=${A}`, SECRET, "203.0.113.60"));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.published, false);
    assert.equal(body.results.length, 1);
    assert.equal(body.results[0].instansId, A);
    assert.equal(body.results[0].ok, true);
    assert.equal(body.results[0].generatedBy, "deterministic", "uden ANTHROPIC_API_KEY bruges deterministisk ranking");
    assert.equal(await db.frontpageSnapshot.count({ where: { instansId: A, status: "godkendt" } }), approvedBefore);
    const proposal = await db.frontpageSnapshot.findUnique({ where: { id: body.results[0].snapshotId } });
    assert.equal(proposal?.status, "forslag");
    assert.equal(proposal?.instansId, A);

    assert.equal((await cronGet(cronReq("?instans=findes-ikke", SECRET, "203.0.113.61"))).status, 404);
  } finally {
    if (saved.s === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved.s;
    if (saved.k !== undefined) process.env.ANTHROPIC_API_KEY = saved.k;
  }
});
