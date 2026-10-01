import assert from "node:assert/strict";
import test from "node:test";
import { composeFrontpage, placementsToPins, assignmentsByModule, type ComposeInput } from "../lib/frontpage/compose";
import { rankCandidates, sortChronological, copenhagenHour } from "../lib/frontpage/rank";
import type { AiSuggestion } from "../lib/frontpage/types";
import { HOUR, INST, NOW, QUOTA_EXCEEDED, QUOTA_OK, cand, hoursAgo, layout } from "./frontpage-fixtures";

const base = (over: Pick<ComposeInput, "modules" | "candidates"> & Partial<ComposeInput>): ComposeInput => ({ instansId: INST, quota: QUOTA_OK, now: NOW, hour: HOUR, ...over });
const slotOf = (res: ReturnType<typeof composeFrontpage>, moduleId: string, i = 0) => res.assignments.find((a) => a.moduleId === moduleId && a.slotIndex === i);

test("ranker er deterministisk: samme input giver samme rækkefølge uanset inputrækkefølge; ties brydes stabilt", () => {
  const items = Array.from({ length: 12 }, (_, i) => cand({ id: `r-${i}`, visninger: (i % 4) * 50, publiceretTid: hoursAgo(1 + (i % 5)) }));
  const a = rankCandidates(items, { now: NOW, hour: HOUR }).map((r) => r.candidate.id);
  const b = rankCandidates([...items].reverse(), { now: NOW, hour: HOUR }).map((r) => r.candidate.id);
  const c = rankCandidates(items, { now: NOW, hour: HOUR }).map((r) => r.candidate.id);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  const twins = [cand({ id: "z" }), cand({ id: "a" })].map((x) => ({ ...x, publiceretTid: hoursAgo(2) }));
  assert.deepEqual(rankCandidates(twins, { now: NOW, hour: HOUR }).map((r) => r.candidate.id), ["a", "z"]);
  assert.deepEqual(sortChronological([{ id: "b", publiceretTid: hoursAgo(1) }, { id: "a", publiceretTid: hoursAgo(5) }]).map((x) => x.id), ["b", "a"]);
});

test("ranker genbruger distribution-engine: breaking og pinned scorer højere; friskhed trækker ned; norm er 0..1", () => {
  const plain = cand({ id: "plain" });
  const breaking = cand({ id: "breaking", breaking: true });
  const old = cand({ id: "old", publiceretTid: hoursAgo(60) });
  const ranked = rankCandidates([plain, old, breaking], { now: NOW, hour: HOUR });
  assert.equal(ranked[0].candidate.id, "breaking");
  assert.equal(ranked[ranked.length - 1].candidate.id, "old");
  for (const r of ranked) assert.ok(r.norm >= 0 && r.norm <= 1);
  assert.equal(copenhagenHour(new Date("2026-10-01T10:00:00Z")), 12);
  assert.equal(copenhagenHour(new Date("2026-01-15T10:00:00Z")), 11);
});

test("compose: deterministisk — samme input giver identisk output", () => {
  const items = Array.from({ length: 15 }, (_, i) => cand({ id: `c-${i}`, visninger: i * 20, publiceretTid: hoursAgo(1 + i) }));
  const m = layout([["hero", "hero"], ["grid", "top-grid"], ["news", "seneste-nyt"]]);
  const a = composeFrontpage(base({ modules: m, candidates: items }));
  const b = composeFrontpage(base({ modules: m, candidates: [...items].reverse() }));
  assert.deepEqual(a.assignments, b.assignments);
  assert.equal(a.assignments.length, 1 + 3 + 8);
  assert.equal(new Set(a.assignments.map((x) => x.articleId)).size, a.assignments.length, "ingen dubletter");
});

test("compose: seneste-nyt er kronologisk og udelukker det der allerede er placeret højere", () => {
  const hot = cand({ id: "hot", visninger: 5000, publiceretTid: hoursAgo(10) });
  const fresh = Array.from({ length: 6 }, (_, i) => cand({ id: `f-${i}`, publiceretTid: hoursAgo(0.5 + i * 0.1), visninger: 1, laesninger: 0, totalLaesetidSek: 0 }));
  const m = layout([["hero", "hero"], ["news", "seneste-nyt", { slots: 4 }]]);
  const res = composeFrontpage(base({ modules: m, candidates: [hot, ...fresh] }));
  assert.equal(slotOf(res, "hero")?.articleId, "hot");
  const news = assignmentsByModule(res.assignments).news.map((a) => a.articleId);
  assert.ok(!news.includes("hot"));
  assert.deepEqual(news, ["f-0", "f-1", "f-2", "f-3"]);
});

test("compose: breaking vinder — nyeste tvinges i hero og alle friske breaking i bjælken; kommerciel/gammel breaking ignoreres", () => {
  const star = cand({ id: "star", visninger: 9999, publiceretTid: hoursAgo(20) });
  const b1 = cand({ id: "b1", breaking: true, publiceretTid: hoursAgo(2), visninger: 0 });
  const b2 = cand({ id: "b2", breaking: true, publiceretTid: hoursAgo(1), visninger: 0 });
  const stale = cand({ id: "stale", breaking: true, publiceretTid: hoursAgo(30) });
  const fakeBreaking = cand({ id: "fake", breaking: true, indholdstype: "Sponsoreret" });
  const m = layout([["bar", "breaking-bar", { slots: 3 }], ["hero", "hero"], ["grid", "top-grid"]]);
  const res = composeFrontpage(base({ modules: m, candidates: [star, b1, b2, stale, fakeBreaking] }));
  assert.equal(slotOf(res, "hero")?.articleId, "b2");
  assert.deepEqual(assignmentsByModule(res.assignments).bar.map((a) => a.articleId), ["b2", "b1"]);
  const all = res.assignments.map((a) => a.articleId);
  assert.ok(!all.includes("fake"), "kommerciel 'breaking' tvinges aldrig frem");
  assert.ok(!assignmentsByModule(res.assignments).bar.some((a) => a.articleId === "stale"), "for gammel breaking er ikke i bjælken");
  assert.notEqual(slotOf(res, "hero")?.articleId, "stale");
  assert.equal(res.assignments.filter((a) => a.articleId === "b2").length, 2, "bjælken må dublere hero");
});

test("compose: redaktørens pin vinder over breaking og AI; breaking flyttes til første ledige top-slot", () => {
  const pinned = cand({ id: "pinned", visninger: 0, publiceretTid: hoursAgo(50) });
  const brk = cand({ id: "brk", breaking: true, publiceretTid: hoursAgo(1) });
  const star = cand({ id: "star", visninger: 9000 });
  const m = layout([["hero", "hero"], ["grid", "top-grid"]]);
  const ai: AiSuggestion[] = [{ articleId: "star", prioritet: 5, forslagModul: "hero", begrundelse: "x", konfidens: 0.95 }];
  const res = composeFrontpage(base({ modules: m, candidates: [pinned, brk, star], pins: [{ articleId: "pinned", moduleType: "hero", slotIndex: 0 }], ai }));
  const hero = slotOf(res, "hero");
  assert.equal(hero?.articleId, "pinned");
  assert.equal(hero?.kilde, "redaktør");
  assert.equal(hero?.locked, true);
  assert.equal(slotOf(res, "grid", 0)?.articleId, "brk");
});

test("compose: udløbne pins ignoreres; pin på ikke-publiceret artikel giver advarsel; Artikel.pinned fastgør i toppen", () => {
  const a = cand({ id: "a" });
  const draft = cand({ id: "draft", status: "Kladde" });
  const flagged = cand({ id: "flagged", pinned: true, visninger: 0, publiceretTid: hoursAgo(40) });
  const m = layout([["hero", "hero"], ["grid", "top-grid"]]);
  const res = composeFrontpage(base({
    modules: m,
    candidates: [a, draft, flagged],
    pins: [{ articleId: "a", moduleType: "hero", expiresAt: new Date(NOW.getTime() - 1000) }, { articleId: "draft", moduleType: "hero" }],
  }));
  assert.ok(res.violations.some((v) => v.code === "pin-ikke-placeret" && v.articleId === "draft"));
  assert.equal(slotOf(res, "hero")?.articleId, "flagged");
  assert.equal(slotOf(res, "hero")?.kilde, "redaktør");
});

test("compose: pin af kommercielt indhold når kvoteloftet er nået placeres ikke (governance > pin)", () => {
  const partner = cand({ id: "partner", indholdstype: "Partner" });
  const other = cand({ id: "other" });
  const m = layout([["hero", "hero"], ["grid", "top-grid"]]);
  const res = composeFrontpage(base({ modules: m, candidates: [partner, other], pins: [{ articleId: "partner", moduleType: "hero" }], quota: QUOTA_EXCEEDED }));
  assert.ok(!res.assignments.some((a) => a.articleId === "partner"));
  assert.ok(res.violations.some((v) => v.code === "kvoteloft"));
  assert.ok(res.violations.some((v) => v.code === "pin-ikke-placeret"));
});

test("compose: AI re-ranker kandidatlisten; lav konfidens ignoreres; ukendte id'er og kommercielt til hero kan ikke snige sig ind", () => {
  const top = cand({ id: "top", visninger: 3000 });
  const mid = cand({ id: "mid", visninger: 1500 });
  const low = cand({ id: "low", visninger: 10 });
  const partner = cand({ id: "partner", indholdstype: "Partner" });
  const m = layout([["hero", "hero"], ["grid", "top-grid", { slots: 2 }]]);

  const det = composeFrontpage(base({ modules: m, candidates: [top, mid, low, partner] }));
  assert.equal(slotOf(det, "hero")?.articleId, "top");

  const ai: AiSuggestion[] = [
    { articleId: "low", prioritet: 5, forslagModul: "hero", begrundelse: "Stor lokal konsekvens.", konfidens: 0.9 },
    { articleId: "top", prioritet: 1, forslagModul: "seneste-nyt", begrundelse: "Ren PR-vinkel.", konfidens: 0.9 },
    { articleId: "partner", prioritet: 5, forslagModul: "hero", begrundelse: "Skal i toppen", konfidens: 1 },
    { articleId: "spøgelse", prioritet: 5, forslagModul: "hero", begrundelse: "findes ikke", konfidens: 1 },
  ];
  const withAi = composeFrontpage(base({ modules: m, candidates: [top, mid, low, partner], ai }));
  const hero = slotOf(withAi, "hero");
  assert.equal(hero?.articleId, "low");
  assert.equal(hero?.kilde, "ai");
  assert.equal(hero?.begrundelse, "Stor lokal konsekvens.");
  assert.equal(hero?.konfidens, 0.9);
  assert.ok(!withAi.assignments.some((a) => a.articleId === "partner" || a.articleId === "spøgelse"));
  assert.equal(withAi.stats.aiUsed >= 1, true);

  const unsure = composeFrontpage(base({ modules: m, candidates: [top, mid, low, partner], ai: [{ ...ai[0], konfidens: 0.2 }] }));
  assert.equal(slotOf(unsure, "hero")?.articleId, "top", "konfidens < 0.4 ignoreres");
  assert.equal(slotOf(unsure, "hero")?.kilde, "regel");
});

test("compose: AI-assisteret aldrig i hero (auto) og aldrig fra Krimi/Sundhed, uanset AI-forslag", () => {
  const ai1 = cand({ id: "ai1", indholdstype: "AI-assisteret", visninger: 9000 });
  const aiKrimi = cand({ id: "aikrimi", indholdstype: "AI-assisteret", kategoriSlug: "krimi-og-retsvaesen", visninger: 9000 });
  const norm = cand({ id: "norm", visninger: 1 });
  const m = layout([["hero", "hero"], ["grid", "top-grid"], ["news", "seneste-nyt", { slots: 3 }]]);
  const ai: AiSuggestion[] = [
    { articleId: "ai1", prioritet: 5, forslagModul: "hero", begrundelse: "x", konfidens: 1 },
    { articleId: "aikrimi", prioritet: 5, forslagModul: "hero", begrundelse: "x", konfidens: 1 },
  ];
  const res = composeFrontpage(base({ modules: m, candidates: [ai1, aiKrimi, norm], ai }));
  assert.equal(slotOf(res, "hero")?.articleId, "norm");
  assert.ok(!res.assignments.some((a) => a.articleId === "aikrimi"));
  assert.ok(res.assignments.some((a) => a.articleId === "ai1" && a.moduleId !== "hero"), "AI-assisteret må stå andre steder");
});

test("compose: diversitet i topzonen og filtre pr. modul (sektion, område)", () => {
  const items = [
    cand({ id: "p1", emneKey: "lokalplan", visninger: 9000 }),
    cand({ id: "p2", emneKey: "lokalplan", visninger: 8000 }),
    cand({ id: "f1", emneKey: "fodbold", visninger: 7000, sektionSlug: "sport", kategoriSlug: "fodbold" }),
    cand({ id: "e1", emneKey: "e1", visninger: 6000 }),
    cand({ id: "e2", emneKey: "e2", visninger: 5000 }),
    cand({ id: "k1", emneKey: "kunst", visninger: 10, sektionSlug: "kultur", kategoriSlug: "musik" }),
    cand({ id: "k2", emneKey: "kunst2", visninger: 9, sektionSlug: "kultur", kategoriSlug: "musik" }),
    cand({ id: "o1", emneKey: "o1", visninger: 8, omraadeSlug: "korsoer" }),
    cand({ id: "o2", emneKey: "o2", visninger: 7, omraadeSlug: "slagelse-by" }),
  ];
  const m = layout([
    ["hero", "hero"],
    ["grid", "top-grid", { slots: 3 }],
    ["kultur", "sektion-rail", { slots: 3, config: { sektionSlug: "kultur" } }],
    ["omr", "dit-omraade", { slots: 2, config: { omraadeSlug: "korsoer" } }],
  ]);
  const res = composeFrontpage(base({ modules: m, candidates: items }));
  const top = res.assignments.filter((a) => a.moduleId === "hero" || a.moduleId === "grid").map((a) => a.articleId);
  assert.ok(!(top.includes("p1") && top.includes("p2")), "højst ét 'lokalplan' i toppen");
  assert.equal(top.length, 4);
  const byModule = assignmentsByModule(res.assignments);
  assert.deepEqual(byModule.kultur.map((a) => a.articleId).sort(), ["k1", "k2"]);
  assert.deepEqual(byModule.omr.map((a) => a.articleId), ["o1"]);
  assert.ok(res.violations.some((v) => v.code === "tom-slot"), "tomme slots giver advarsel");
});

test("compose: partner/sponsoreret fylder kun deres bokse, og kun når kvoteloftet tillader det", () => {
  const items = [
    ...Array.from({ length: 10 }, (_, i) => cand({ id: `e-${i}`, visninger: 100 - i })),
    cand({ id: "partner", indholdstype: "Partner" }),
    cand({ id: "sponsor", indholdstype: "Sponsoreret" }),
  ];
  const m = layout([["hero", "hero"], ["grid", "top-grid"], ["news", "seneste-nyt"], ["pb", "partner-break"], ["sb", "sponsoreret-break"]]); // 14 slots, loft 25 % = 3
  const ok = composeFrontpage(base({ modules: m, candidates: items }));
  assert.equal(slotOf(ok, "pb")?.articleId, "partner");
  assert.equal(slotOf(ok, "sb")?.articleId, "sponsor");
  assert.ok(!ok.assignments.some((a) => ["partner", "sponsor"].includes(a.articleId) && !["pb", "sb"].includes(a.moduleId)));
  const exceeded = composeFrontpage(base({ modules: m, candidates: items, quota: QUOTA_EXCEEDED }));
  assert.ok(!exceeded.assignments.some((a) => ["partner", "sponsor"].includes(a.articleId)));
});

test("compose: fremmed instans og ikke-publicerede kandidater ignoreres; kun mærkede kommercielle kommer med", () => {
  const foreign = cand({ id: "foreign", instansId: "inst-b", visninger: 99999 });
  const draft = cand({ id: "draft", status: "Kladde", visninger: 99999 });
  const noLabel = cand({ id: "nolabel", indholdstype: "Partner", harMaerkning: false });
  const ok = cand({ id: "ok" });
  const m = layout([["hero", "hero"], ["pb", "partner-break"]]);
  const res = composeFrontpage(base({ modules: m, candidates: [foreign, draft, noLabel, ok] }));
  assert.deepEqual(res.assignments.map((a) => a.articleId), ["ok"]);
  assert.ok(res.violations.some((v) => v.code === "tenant"));
});

test("compose: hver tildeling har synlig mærkning, prioritet 1–5 og begrundelse <= 200 tegn", () => {
  const items = Array.from({ length: 10 }, (_, i) => cand({ id: `m-${i}`, visninger: i * 10 }));
  const m = layout([["hero", "hero"], ["grid", "top-grid"], ["news", "seneste-nyt"]]);
  const res = composeFrontpage(base({ modules: m, candidates: items }));
  for (const a of res.assignments) {
    assert.equal(a.label.synlig, true);
    assert.ok(a.label.tekst.length > 0);
    assert.ok(a.prioritet >= 1 && a.prioritet <= 5);
    assert.ok(a.begrundelse.length > 0 && a.begrundelse.length <= 200);
  }
});

test("placementsToPins oversætter eksisterende zoner til pins", () => {
  const pins = placementsToPins([
    { articleId: "a", zone: "top-hoved", position: 3 },
    { articleId: "b", zone: "top-sekundaer", position: 1, udloebTid: NOW },
    { articleId: "c", zone: "ukendt", position: 0 },
  ]);
  assert.equal(pins.length, 2);
  assert.deepEqual([pins[0].moduleType, pins[0].slotIndex], ["hero", 0]);
  assert.deepEqual([pins[1].moduleType, pins[1].slotIndex], ["top-grid", 1]);
});
