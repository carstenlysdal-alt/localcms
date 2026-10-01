import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_MODEL, createAnthropicTextClient, extractJson, resolveModel, type AiRequest, type AiTextClient } from "../lib/frontpage/ai-client";
import { RANKER_SYSTEM_PROMPT, parseAiRankerOutput, rankWithAi } from "../lib/frontpage/ai-ranker";
import { composeFrontpage } from "../lib/frontpage/compose";
import { resolveFrontpage, latestNewsFallback, type ApprovedSnapshotInput } from "../lib/frontpage/fallback";
import { rankCandidates } from "../lib/frontpage/rank";
import type { SnapshotItems } from "../lib/frontpage/types";
import { HOUR, INST, NOW, QUOTA_OK, cand, hoursAgo, layout } from "./frontpage-fixtures";

const noSleep = async () => undefined;
const mods = layout([["hero", "hero"], ["grid", "top-grid"], ["news", "seneste-nyt", { slots: 4 }]]);
const pool = Array.from({ length: 10 }, (_, i) => cand({ id: `a-${i}`, visninger: 1000 - i * 50, publiceretTid: hoursAgo(1 + i) }));
const ranked = () => rankCandidates(pool, { now: NOW, hour: HOUR });
const reply = (items: unknown[]) => JSON.stringify({ forslag: items });
const good = (id: string, over: Record<string, unknown> = {}) => ({ articleId: id, prioritet: 4, forslagModul: "hero", begrundelse: "Vigtig lokal sag.", konfidens: 0.8, ...over });

function fake(responses: Array<string | Error | "hang">): { client: AiTextClient; calls: AiRequest[] } {
  const calls: AiRequest[] = [];
  let i = 0;
  const client: AiTextClient = (req) => {
    calls.push(req);
    const r = responses[Math.min(i++, responses.length - 1)];
    if (r === "hang") return new Promise(() => undefined);
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve({ text: r, modelId: "fake-model" });
  };
  return { client, calls };
}

test("ai-client: model fra ANTHROPIC_MODEL med default claude-sonnet-4-6; ingen nøgle => ingen klient", () => {
  const saved = { m: process.env.ANTHROPIC_MODEL, k: process.env.ANTHROPIC_API_KEY };
  try {
    delete process.env.ANTHROPIC_MODEL;
    assert.equal(resolveModel(), "claude-sonnet-4-6");
    assert.equal(DEFAULT_MODEL, "claude-sonnet-4-6");
    process.env.ANTHROPIC_MODEL = "claude-test";
    assert.equal(resolveModel(), "claude-test");
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal(createAnthropicTextClient(), null);
  } finally {
    if (saved.m === undefined) delete process.env.ANTHROPIC_MODEL; else process.env.ANTHROPIC_MODEL = saved.m;
    if (saved.k === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved.k;
  }
});

test("extractJson tåler ```json-hegn og indledende tekst; kaster på ikke-JSON", () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('Her er svaret: {"a":{"b":2}} tak'), { a: { b: 2 } });
  assert.throws(() => extractJson("ingen json her"));
});

test("ai-ranker: gyldigt svar valideres (zod) og returneres med modelId og inputHash; stabil systemprompt sendes", async () => {
  const { client, calls } = fake([reply([good("a-0"), good("a-1", { prioritet: 2, forslagModul: "top-grid" })])]);
  const res = await rankWithAi({ modules: mods, ranked: ranked(), now: NOW }, { client, sleep: noSleep });
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.suggestions.length, 2);
  assert.equal(res.modelId, "fake-model");
  assert.equal(res.inputHash.length, 32);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].system, RANKER_SYSTEM_PROMPT);
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(calls[0].system), "ingen datoer i den cachede systemprompt");
  assert.ok(calls[0].user.includes("a-0"));
});

test("ai-ranker: inputHash er stabil for samme data og ændres når data ændres", async () => {
  const run = async (items: typeof pool) => {
    const { client } = fake([reply([good("a-0")])]);
    const r = await rankWithAi({ modules: mods, ranked: rankCandidates(items, { now: NOW, hour: HOUR }), now: NOW }, { client, sleep: noSleep });
    return r.ok ? r.inputHash : "";
  };
  const h1 = await run(pool);
  const h2 = await run([...pool].reverse());
  const h3 = await run(pool.slice(1));
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});

test("ai-ranker: ugyldig JSON -> ét genforsøg -> {ok:false, ugyldig-json} (kaster aldrig)", async () => {
  const { client, calls } = fake(["det her er ikke json", "stadig ikke json"]);
  const res = await rankWithAi({ modules: mods, ranked: ranked(), now: NOW }, { client, sleep: noSleep });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, "ugyldig-json");
  assert.equal(calls.length, 2);
});

test("ai-ranker: første svar ugyldigt, andet gyldigt -> ok efter genforsøg", async () => {
  const { client, calls } = fake(["{broken", reply([good("a-2")])]);
  const res = await rankWithAi({ modules: mods, ranked: ranked(), now: NOW }, { client, sleep: noSleep });
  assert.ok(res.ok);
  assert.equal(calls.length, 2);
  if (res.ok) assert.equal(res.attempts, 2);
});

test("ai-ranker: timeout (klienten svarer aldrig) -> genforsøg -> {ok:false, timeout}", async () => {
  const { client, calls } = fake(["hang"]);
  const t0 = Date.now();
  const res = await rankWithAi({ modules: mods, ranked: ranked(), now: NOW }, { client, timeoutMs: 25, sleep: noSleep });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, "timeout");
  assert.equal(calls.length, 2);
  assert.ok(Date.now() - t0 < 2000);
  assert.ok(calls[0].signal.aborted, "kaldet afbrydes via AbortSignal");
});

test("ai-ranker: API-fejl — 5xx/429 genforsøges, 4xx (fx 401) gør ikke; synkron kast fanges", async () => {
  const serverErr = Object.assign(new Error("overloaded"), { status: 529 });
  const r1 = fake([serverErr, reply([good("a-0")])]);
  assert.ok((await rankWithAi({ modules: mods, ranked: ranked(), now: NOW }, { client: r1.client, sleep: noSleep })).ok);
  assert.equal(r1.calls.length, 2);

  const authErr = Object.assign(new Error("invalid x-api-key"), { status: 401 });
  const r2 = fake([authErr]);
  const res2 = await rankWithAi({ modules: mods, ranked: ranked(), now: NOW }, { client: r2.client, sleep: noSleep });
  assert.equal(res2.ok, false);
  if (!res2.ok) assert.equal(res2.reason, "api-fejl");
  assert.equal(r2.calls.length, 1);

  const thrower: AiTextClient = () => {
    throw new Error("sync boom");
  };
  const res3 = await rankWithAi({ modules: mods, ranked: ranked(), now: NOW }, { client: thrower, sleep: noSleep });
  assert.equal(res3.ok, false);
});

test("ai-ranker: ingen klient (ingen nøgle) og ingen kandidater -> {ok:false}", async () => {
  const none = await rankWithAi({ modules: mods, ranked: ranked(), now: NOW }, { client: null });
  assert.deepEqual([none.ok, !none.ok && none.reason], [false, "ingen-noegle"]);
  const { client } = fake([reply([good("a-0")])]);
  assert.equal((await rankWithAi({ modules: mods, ranked: [], now: NOW }, { client })).ok, false);
});

test("ai-ranker: streng schema — prioritet 1–5, begrundelse <= 200, konfidens 0–1, kendt modul og articleId", () => {
  const known = new Set(["a-0", "a-1", "a-2", "a-3", "a-4", "a-5", "a-6", "a-7", "a-8", "a-9"]);
  const ok = parseAiRankerOutput(reply(good("a-0") ? [good("a-0"), good("a-1"), good("a-2"), good("a-3")] : []), known);
  assert.equal(ok.suggestions.length, 4);

  // Ét dårligt element af ti droppes; resten bevares.
  const mixed = Array.from({ length: 9 }, (_, i) => good(`a-${i}`));
  const dropOne = parseAiRankerOutput(reply([...mixed, good("a-9", { prioritet: 9 })]), known);
  assert.equal(dropOne.suggestions.length, 9);
  assert.equal(dropOne.dropped, 1);

  for (const bad of [
    good("a-0", { prioritet: 0 }),
    good("a-0", { prioritet: 3.5 }),
    good("a-0", { konfidens: 1.5 }),
    good("a-0", { begrundelse: "x".repeat(201) }),
    good("a-0", { begrundelse: "" }),
    good("a-0", { forslagModul: "annonce-boks" }),
    good("ukendt-id"),
    { ...good("a-0"), ekstra: "felt" },
  ]) {
    assert.throws(() => parseAiRankerOutput(reply([bad]), known), /.+/, JSON.stringify(bad));
  }
  assert.throws(() => parseAiRankerOutput(JSON.stringify({ andet: [] }), known));
  assert.throws(() => parseAiRankerOutput(reply([]), known));
  // For mange ugyldige (>30 %) kasserer hele svaret.
  assert.throws(() => parseAiRankerOutput(reply([good("a-0"), good("a-1"), good("ukendt-1"), good("ukendt-2")]), known));
  // Dubletter: første vinder.
  const dup = parseAiRankerOutput(reply([good("a-0", { prioritet: 5 }), good("a-0", { prioritet: 1 }), good("a-1"), good("a-2"), good("a-3"), good("a-4"), good("a-5"), good("a-6"), good("a-7"), good("a-8")]), known);
  assert.equal(dup.suggestions.find((s) => s.articleId === "a-0")?.prioritet, 5);
});

test("AI kan ikke bryde rækværk: forslag om kommercielt/AI-assisteret i hero ignoreres af komponeringen", async () => {
  const partner = cand({ id: "pp", indholdstype: "Partner", visninger: 5 });
  const aiArt = cand({ id: "aa", indholdstype: "AI-assisteret", visninger: 5 });
  const items = [...pool, partner, aiArt];
  const { client } = fake([reply([good("pp", { prioritet: 5, konfidens: 1 }), good("aa", { prioritet: 5, konfidens: 1 })])]);
  const r = await rankWithAi({ modules: mods, ranked: rankCandidates(items, { now: NOW, hour: HOUR }), now: NOW }, { client, sleep: noSleep });
  assert.ok(r.ok);
  if (!r.ok) return;
  const res = composeFrontpage({ instansId: INST, modules: mods, candidates: items, ai: r.suggestions, quota: QUOTA_OK, now: NOW, hour: HOUR });
  const hero = res.assignments.find((a) => a.moduleId === "hero");
  assert.ok(hero && hero.articleId !== "pp" && hero.articleId !== "aa");
  assert.ok(!res.assignments.some((a) => a.articleId === "pp"));
});

// ── Fallback-kæden ──────────────────────────────────────────────────────────

function snapshotFor(candidates = pool, over: Partial<ApprovedSnapshotInput> = {}, layoutVersion = 3, kilde: "ai" | "regel" = "ai"): ApprovedSnapshotInput {
  const composed = composeFrontpage({ instansId: INST, modules: mods, candidates, quota: QUOTA_OK, now: NOW, hour: HOUR });
  const items: SnapshotItems = { schemaVersion: 1, layoutVersion, assignments: composed.assignments.map((a) => ({ ...a, kilde })), warnings: [] };
  return { id: "snap-1", layoutId: "layout-1", items, expiresAt: new Date(NOW.getTime() + 3_600_000), ...over };
}
const resolveWith = (approved: ApprovedSnapshotInput | null, candidates = pool, extra: Record<string, unknown> = {}) =>
  resolveFrontpage({ instansId: INST, modules: mods, layout: { id: "layout-1", version: 3 }, candidates, quota: QUOTA_OK, approved, now: NOW, hour: HOUR, ...extra });

test("fallback 1: sidst godkendte snapshot vises uændret når det er gyldigt", () => {
  const snap = snapshotFor();
  const res = resolveWith(snap);
  assert.equal(res.source, "godkendt-snapshot");
  assert.equal(res.snapshotId, "snap-1");
  assert.equal(res.repaired, 0);
  assert.deepEqual(res.assignments.map((a) => a.articleId), snap.items.assignments.map((a) => a.articleId));
});

test("fallback 2: intet godkendt / udløbet / layout ændret -> deterministisk score", () => {
  assert.equal(resolveWith(null).source, "deterministisk");
  const expired = resolveWith(snapshotFor(pool, { expiresAt: new Date(NOW.getTime() - 1000) }));
  assert.equal(expired.source, "deterministisk");
  assert.match(expired.reason, /udløbet/);
  const changedVersion = resolveFrontpage({ instansId: INST, modules: mods, layout: { id: "layout-1", version: 4 }, candidates: pool, quota: QUOTA_OK, approved: snapshotFor(), now: NOW, hour: HOUR });
  assert.equal(changedVersion.source, "deterministisk");
  assert.match(changedVersion.reason, /Layoutet er ændret/);
  const otherLayout = resolveWith(snapshotFor(pool, { layoutId: "layout-andet" }));
  assert.equal(otherLayout.source, "deterministisk");
  assert.ok(resolveWith(null).assignments.length > 0);
});

test("fallback 1b: afpubliceret artikel i godkendt snapshot erstattes deterministisk (repareret), resten bevares", () => {
  const snap = snapshotFor();
  const victim = snap.items.assignments[1].articleId;
  const live = pool.map((c) => (c.id === victim ? { ...c, status: "Afpubliceret" } : c));
  const res = resolveWith(snap, live);
  assert.equal(res.source, "godkendt-snapshot");
  assert.equal(res.repaired, 1);
  assert.ok(!res.assignments.some((a) => a.articleId === victim));
  assert.equal(res.assignments.length, snap.items.assignments.length, "hullet fyldes");
  assert.equal(res.assignments[0].articleId, snap.items.assignments[0].articleId);
});

test("fallback: godkendt snapshot hvor alt er ugyldigt -> deterministisk; tenant-skift fjerner placeringer", () => {
  const snap = snapshotFor();
  const gone = pool.map((c) => ({ ...c, status: "Kladde" }));
  const res = resolveWith(snap, gone);
  assert.notEqual(res.source, "godkendt-snapshot");
  const foreign = resolveWith(snap, pool.map((c) => ({ ...c, instansId: "inst-b" })));
  assert.equal(foreign.assignments.length, 0, "intet fra en anden instans vises nogensinde");
});

test("fallback 3: giver deterministisk intet (alt for gammelt) -> seneste nyt, nyeste først; ellers aldrig kommercielt", () => {
  const old = Array.from({ length: 6 }, (_, i) => cand({ id: `o-${i}`, publiceretTid: hoursAgo(200 + i * 10) }));
  const partner = cand({ id: "partner", indholdstype: "Partner", publiceretTid: hoursAgo(1) });
  const res = resolveWith(null, [...old, partner]);
  assert.equal(res.source, "seneste-nyt");
  assert.deepEqual(res.assignments.map((a) => a.articleId).slice(0, 3), ["o-0", "o-1", "o-2"]);
  assert.ok(!res.assignments.some((a) => a.articleId === "partner"));
  for (const a of res.assignments) assert.equal(a.label.synlig, true);
});

test("fallback: kaster aldrig — selv med ødelagte data fås en (tom) seneste-nyt-model", () => {
  const poisoned = { ...cand(), get indholdstype(): string { throw new Error("boom"); } };
  let res!: ReturnType<typeof resolveFrontpage>;
  assert.doesNotThrow(() => {
    res = resolveWith(null, [poisoned as never]);
  });
  assert.equal(res.source, "seneste-nyt");
  assert.deepEqual(res.assignments, []);
  assert.doesNotThrow(() => resolveWith(null, []));
  assert.equal(resolveWith(null, []).assignments.length, 0);
});

test("latestNewsFallback: bruger standardlayout hvis layoutet kun har breaks/dynamiske moduler; tenant og status gælder", () => {
  const onlyBreaks = layout([["pb", "partner-break"], ["kal", "kalender-strip", { slots: 3 }]]);
  const items = [cand({ id: "n1" }), cand({ id: "n2", instansId: "inst-b" }), cand({ id: "n3", status: "Kladde" })];
  const res = latestNewsFallback({ modules: onlyBreaks, candidates: items, ctx: { instansId: INST, now: NOW, kvoteloftProcent: 25, quotaExceeded: false } });
  assert.ok(res.modules.some((m) => m.type === "hero"));
  assert.deepEqual(res.assignments.map((a) => a.articleId), ["n1"]);
});
