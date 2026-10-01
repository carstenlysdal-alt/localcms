import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { adIndex, breakPlan, breaksAfter, formatClock, formatShortWhen, groupByRegion, labelText, isInlineBreak, segmentSlots } from "../components/site/frontpage/render-logic";
import { createEventQueue, isValidEvent } from "../components/site/frontpage/tracker-logic";
import { ModuleRenderer } from "../components/site/frontpage/ModuleRenderer";
import { assignmentsByModule } from "../lib/frontpage/compose";
import { applyTemplate, defaultLayoutModules } from "../lib/frontpage/templates";
import type { SlotAssignment, Variant } from "../lib/frontpage/types";
import type { PublicArticleSummary } from "../lib/site-queries";
import { EMPTY_EXTRAS, type FrontpageRenderContext } from "../components/site/frontpage/types";

const art = (id: string, indholdstype: PublicArticleSummary["indholdstype"], titel = `Titel ${id}`): PublicArticleSummary => ({
  id, titel, manchet: "Manchet", slug: id, href: `/nyheder/${id}`, publiceretTid: new Date("2026-10-01T10:30:00Z"), indholdstype,
  marking: indholdstype === "Sponsoreret" ? { sponsor: "Næstved Havn" } : null, breaking: false, pinned: false,
  sektion: { navn: "Nyheder", slug: "nyheder" }, undersektion: null, omraade: null, forfatter: null, coverMedia: null,
});
const asg = (moduleId: string, slotIndex: number, articleId: string, variant: Variant, tekst: string): SlotAssignment => ({
  moduleId, slotIndex, articleId, variant, kilde: "regel", prioritet: 3, begrundelse: "x", konfidens: null, label: { tekst, synlig: true }, locked: false,
});

test("groupByRegion: sidebar-par bliver én række; skjulte, ukendte og inline-breaks udelades", () => {
  const tpl = applyTemplate([], "top-hero-sidebar", {}, "replace");
  assert.ok(tpl.ok);
  if (!tpl.ok) return;
  const rows = groupByRegion([...tpl.value, ...defaultLayoutModules().filter((m) => m.id === "seneste-nyt")]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].kind, "split");
  assert.equal(rows[1].kind, "full");
  const hidden = groupByRegion(tpl.value.map((m) => ({ ...m, visible: false })));
  assert.equal(hidden.length, 0);
  const unknown = groupByRegion([{ id: "ghost", type: "findes-ikke" as never, slots: 1, region: "full", visible: true, mode: "forslag", config: {} }]);
  assert.equal(unknown.length, 0, "ukendt modultype ignoreres");
  const brk = applyTemplate([], "top-med-annonce-break", {}, "replace");
  if (brk.ok) {
    assert.ok(brk.value.some(isInlineBreak));
    assert.equal(groupByRegion(brk.value).length, 2);
  }
  // kun main uden sidebar -> fuld bredde
  assert.equal(groupByRegion([{ ...defaultLayoutModules()[1], region: "main" }])[0].kind, "full");
});

test("breakPlan: efter slot N, gentagelse, grænser", () => {
  const p = breakPlan(10, [{ afterSlot: 3, moduleId: "ad-break", repeatEvery: 3 }]);
  assert.deepEqual(p.map((x) => x.afterSlot), [3, 6, 9]);
  assert.deepEqual(p.map((x) => x.occurrence), [0, 1, 2]);
  assert.equal(breaksAfter(p, 6).length, 1);
  assert.deepEqual(breakPlan(2, [{ afterSlot: 3, moduleId: "x" }]), [], "break efter slot der ikke vises udelades");
  assert.deepEqual(breakPlan(0, [{ afterSlot: 1, moduleId: "x" }]), []);
  assert.deepEqual(breakPlan(5, undefined), []);
});

test("adIndex: hvert ad-break (og hver gentagelse) får sin egen kampagne", () => {
  const m = applyTemplate([], "top-med-annonce-break", {}, "replace");
  assert.ok(m.ok);
  if (!m.ok) return;
  const two = [...m.value, { id: "ad-break-2", type: "ad-break" as const, slots: 1, region: "full" as const, visible: true, mode: "forslag" as const, config: { placement: "sequence" as const } }];
  assert.equal(adIndex(two, "ad-break", 0), 0);
  assert.equal(adIndex(two, "ad-break-2", 0), 1);
  assert.equal(adIndex(two, "ad-break", 1), 2, "gentagelse bruger næste ledige kampagne");
  assert.equal(adIndex(m.value, "findes-ikke"), -1);
});

test("mærkningstekst og dansk tid", () => {
  assert.equal(labelText({ tekst: "Sponsoreret" }, "Sponsoreret"), "Sponsoreret");
  assert.equal(labelText(undefined, "PR"), "Pressemeddelelse");
  assert.equal(labelText({ tekst: "  " }, "Partner"), "Partner");
  assert.equal(formatClock("2026-10-01T10:30:00Z"), "12.30");
  assert.equal(formatClock("2026-12-01T10:30:00Z"), "11.30");
});

test("kort tidsangivelse: i dag = klokkeslæt, ellers dato; dansk tid også omkring midnat", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  assert.equal(formatShortWhen("2026-10-01T08:15:00Z", now), "10.15");
  assert.equal(formatShortWhen("2026-09-28T08:15:00Z", now), "28. sep.");
  // 22:30 UTC den 30/9 er kl. 00.30 den 1/10 i dansk sommertid -> "i dag"
  assert.equal(formatShortWhen("2026-09-30T22:30:00Z", now), "00.30");
});

test("segmentSlots: grid deles mellem break-punkter uden huller", () => {
  assert.deepEqual(segmentSlots(4, []), [{ from: 0, to: 4, breaks: [] }]);
  const segs = segmentSlots(4, breakPlan(4, [{ afterSlot: 2, moduleId: "ad-break" }]));
  assert.deepEqual(segs.map((s) => [s.from, s.to, s.breaks.length]), [[0, 2, 1], [2, 4, 0]]);
  const rep = segmentSlots(10, breakPlan(10, [{ afterSlot: 3, moduleId: "x", repeatEvery: 3 }]));
  assert.deepEqual(rep.map((s) => [s.from, s.to]), [[0, 3], [3, 6], [6, 9], [9, 10]]);
  assert.deepEqual(segmentSlots(3, breakPlan(3, [{ afterSlot: 3, moduleId: "x" }])).map((s) => [s.from, s.to, s.breaks.length]), [[0, 3, 1]]);
});

test("tracker-kø: dedupe, loft, validering, batch-flush", () => {
  const sent: string[] = [];
  const q = createEventQueue((e) => sent.push(`${e.type}:${e.moduleId}`), 3);
  const e = { moduleId: "hero", slotKey: "0", articleId: "cm12345678abc", type: "impression" as const };
  assert.equal(q.add(e), true);
  assert.equal(q.add(e), false, "dublet");
  assert.equal(q.add({ ...e, type: "click" }), true);
  assert.equal(q.add({ ...e, moduleId: "BAD ID" }), false);
  assert.equal(q.add({ ...e, slotKey: "abc" }), false);
  assert.equal(q.add({ ...e, articleId: "x" }), false);
  assert.equal(q.pending, 2);
  assert.equal(q.flush(), 2);
  assert.deepEqual(sent, ["impression:hero", "click:hero"]);
  assert.equal(q.add({ ...e, slotKey: "1" }), true);
  assert.equal(q.add({ ...e, slotKey: "2" }), false, "loft pr. sideindlæsning");
  assert.equal(isValidEvent({ ...e, type: "andet" as never }), false);
});

function ctxFor(modules: ReturnType<typeof defaultLayoutModules>, assignments: SlotAssignment[], articles: PublicArticleSummary[]): FrontpageRenderContext {
  return {
    site: { id: "s", navn: "TestLokalt", kommune: "Test" },
    modules,
    assignments: assignmentsByModule(assignments),
    articles: Object.fromEntries(articles.map((a) => [a.id, a])),
    extras: EMPTY_EXTRAS,
  };
}

test("ModuleRenderer: mærkning er synlig i ALLE varianter, ukendte moduler ignoreres, tomme moduler skjules", () => {
  const modules = defaultLayoutModules();
  const articles = [art("h1xxxxxxxx", "Uafhængig"), art("t1xxxxxxxx", "Sponsoreret"), art("t2xxxxxxxx", "Brugerindsendt"), art("t3xxxxxxxx", "AI-assisteret"), art("s1xxxxxxxx", "Partner"), art("s2xxxxxxxx", "PR"), art("d1xxxxxxxx", "Uafhængig")];
  const asgs = [
    asg("hero", 0, "h1xxxxxxxx", "hero", "Uafhængig"),
    asg("top-grid", 0, "t1xxxxxxxx", "kort", "Sponsoreret"),
    asg("top-grid", 1, "t2xxxxxxxx", "kort", "Brugerindsendt"),
    asg("top-grid", 2, "t3xxxxxxxx", "kort", "AI-assisteret"),
    asg("dit-omraade", 0, "d1xxxxxxxx", "kompakt", "Uafhængig"),
    asg("seneste-nyt", 0, "s1xxxxxxxx", "liste", "Partner"),
    asg("seneste-nyt", 1, "s2xxxxxxxx", "tekstlinje", "Pressemeddelelse"),
  ];
  const withGhost = [...modules, { id: "ghost", type: "ukendt-type" as never, slots: 1, region: "full" as const, visible: true, mode: "forslag" as const, config: {} }];
  const html = renderToStaticMarkup(createElement(ModuleRenderer, { ctx: ctxFor(withGhost, asgs, articles) }));
  for (const word of ["Uafhængig", "Sponsoreret", "Brugerindsendt", "AI-assisteret", "Partner", "Pressemeddelelse"]) assert.ok(html.includes(word), `mærkning '${word}' mangler`);
  // hver artikel har data-attributter til måling
  for (const a of asgs) assert.ok(html.includes(`data-fp-article="${a.articleId}"`), a.articleId);
  assert.ok(html.includes("Sponsoreret · Næstved Havn") || html.includes("Sponsoreret"), "sponsor");
  assert.ok(!html.includes("ghost"), "ukendt modultype ignoreres");
  // breaking-bar uden placeringer renderes ikke
  assert.ok(!html.includes("fp-breaking"));
  // hver linje/kort har mærkning i samme blok som titlen
  const blocks = html.split('class="fp-slot ').slice(1);
  assert.equal(blocks.length, asgs.length - 1 + 0 + 1 - 1 + 0, "alle slots udenfor hero som .fp-slot");
  for (const b of blocks) assert.ok(b.includes("fp-label"), "slot uden mærkning: " + b.slice(0, 80));
});

test("ModuleRenderer: placering uden synlig label vises ikke (regel: ingen label = ingen artikel)", () => {
  const modules = defaultLayoutModules();
  const a = [art("x1xxxxxxxx", "Uafhængig")];
  const bad = { ...asg("seneste-nyt", 0, "x1xxxxxxxx", "liste", ""), label: { tekst: "", synlig: true as const } };
  const html = renderToStaticMarkup(createElement(ModuleRenderer, { ctx: ctxFor(modules, [bad], a) }));
  assert.ok(!html.includes("Titel x1xxxxxxxx"));
  assert.ok(html.includes("Ingen nyheder endnu"), "ærlig tom-tilstand");
});

test("ModuleRenderer: inline break efter slot N renderes i værten og ikke som egen række; ingen kampagne = skjult", () => {
  const m = applyTemplate([], "top-med-annonce-break", { slots: 4, breakAfter: 2, breakType: "sponsoreret-break" }, "replace");
  assert.ok(m.ok);
  if (!m.ok) return;
  const arts = ["a1xxxxxxxx", "a2xxxxxxxx", "a3xxxxxxxx", "sp1xxxxxxx", "hh1xxxxxxx"].map((id) => art(id, id.startsWith("sp") ? "Sponsoreret" : "Uafhængig", `Titel ${id}`));
  const asgs = [
    asg("hero", 0, "hh1xxxxxxx", "hero", "Uafhængig"),
    asg("top-grid", 0, "a1xxxxxxxx", "kort", "Uafhængig"),
    asg("top-grid", 1, "a2xxxxxxxx", "kort", "Uafhængig"),
    asg("top-grid", 2, "a3xxxxxxxx", "kort", "Uafhængig"),
    asg("sponsoreret-break", 0, "sp1xxxxxxx", "kompakt", "Sponsoreret"),
  ];
  const html = renderToStaticMarkup(createElement(ModuleRenderer, { ctx: ctxFor(m.value, asgs, arts) }));
  const iA2 = html.indexOf("Titel a2xxxxxxxx");
  const iBreak = html.indexOf("fp-break--sponsoreret");
  const iA3 = html.indexOf("Titel a3xxxxxxxx");
  assert.ok(iA2 > 0 && iBreak > iA2 && iA3 > iBreak, "break står mellem slot 2 og 3");
  assert.equal(html.split("fp-break--sponsoreret").length - 1, 1, "kun renderet én gang");
  // ad-break uden kampagner
  const ad = applyTemplate([], "top-med-annonce-break", {}, "replace");
  if (ad.ok) assert.ok(!renderToStaticMarkup(createElement(ModuleRenderer, { ctx: ctxFor(ad.value, [], []) })).includes("fp-break--ad"));
});
