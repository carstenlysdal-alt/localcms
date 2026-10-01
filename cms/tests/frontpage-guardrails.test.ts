import assert from "node:assert/strict";
import test from "node:test";
import { commercialCap, enforceGuardrails, findEmptySlots, labelFor, placementProblems, type GuardContext } from "../lib/frontpage/guardrails";
import type { Candidate, SlotAssignment } from "../lib/frontpage/types";
import { INST, NOW, cand, hoursAgo, layout } from "./frontpage-fixtures";

const ctx = (over: Partial<GuardContext> = {}): GuardContext => ({ instansId: INST, now: NOW, kvoteloftProcent: 25, quotaExceeded: false, ...over });

function asg(c: Candidate, moduleId: string, slotIndex: number, kilde: SlotAssignment["kilde"] = "regel", over: Partial<SlotAssignment> = {}): SlotAssignment {
  return { moduleId, slotIndex, articleId: c.id, variant: "kort", kilde, prioritet: 3, begrundelse: "test", konfidens: null, label: labelFor(c), locked: kilde === "redaktør", ...over };
}
const codes = (r: { violations: { code: string }[] }) => r.violations.map((v) => v.code);
const run = (mods: ReturnType<typeof layout>, assignments: SlotAssignment[], candidates: Candidate[], c: Partial<GuardContext> = {}, skipFreshness = false) =>
  enforceGuardrails({ modules: mods, assignments, candidates, ctx: ctx(c), skipFreshness });

test("tenant-isolation: artikel fra anden instans afvises", () => {
  const m = layout([["grid", "top-grid"]]);
  const foreign = cand({ instansId: "inst-b" });
  const r = run(m, [asg(foreign, "grid", 0)], [foreign]);
  assert.equal(r.assignments.length, 0);
  assert.ok(codes(r).includes("tenant"));
});

test("kun Publiceret (og ikke fremtidig publiceringstid) må vises", () => {
  const m = layout([["grid", "top-grid"]]);
  const draft = cand({ status: "Kladde" });
  const future = cand({ publiceretTid: new Date(NOW.getTime() + 3_600_000) });
  const unpublished = cand({ publiceretTid: null });
  const r = run(m, [asg(draft, "grid", 0), asg(future, "grid", 1), asg(unpublished, "grid", 2)], [draft, future, unpublished]);
  assert.equal(r.assignments.length, 0);
  assert.equal(codes(r).filter((c) => c === "status").length, 3);
});

test("mærkning: kommerciel/brugerindsendt artikel uden gyldig mærkning kan ikke vises", () => {
  const m = layout([["pb", "partner-break"]]);
  const partner = cand({ indholdstype: "Partner", harMaerkning: false });
  assert.equal(run(m, [asg(partner, "pb", 0)], [partner]).assignments.length, 0);
});

test("mærkning kan ikke fjernes: label udledes altid af artiklen og er synlig", () => {
  const m = layout([["grid", "top-grid"], ["pb", "partner-break"]]);
  const partner = cand({ indholdstype: "Partner", maerkningTekst: "Partner: Fjordbyg A/S" });
  const filler = [cand(), cand(), cand()];
  const tampered = asg(partner, "pb", 0, "ai", { label: { tekst: "", synlig: false as unknown as true } });
  const r = run(m, [...filler.map((c, i) => asg(c, "grid", i)), tampered], [...filler, partner]);
  const kept = r.assignments.find((a) => a.articleId === partner.id);
  assert.ok(kept);
  assert.deepEqual(kept.label, { tekst: "Partner: Fjordbyg A/S", synlig: true });
  assert.ok(codes(r).includes("maerkning"));
  assert.equal(labelFor(cand()).tekst, "Uafhængig");
  assert.equal(labelFor(cand({ indholdstype: "AI-assisteret" })).synlig, true);
});

test("AI-assisteret: aldrig automatisk i hero; redaktør må; aldrig fra Krimi/Sundhed (heller ikke for redaktør)", () => {
  const m = layout([["hero", "hero"], ["grid", "top-grid"]]);
  const ai = cand({ indholdstype: "AI-assisteret" });
  assert.ok(placementProblems(ai, m[0], 0, "ai", ctx()).some((v) => v.code === "ai-hero"));
  assert.ok(placementProblems(ai, m[0], 0, "regel", ctx()).some((v) => v.code === "ai-hero"));
  assert.equal(placementProblems(ai, m[0], 0, "redaktør", ctx()).length, 0);

  const krimi = cand({ indholdstype: "AI-assisteret", kategoriSlug: "krimi-og-retsvaesen", kategoriNavn: "Krimi og retsvæsen" });
  const sundhed = cand({ indholdstype: "AI-assisteret", kategoriSlug: "sundhed", kategoriNavn: "Sundhed" });
  for (const c of [krimi, sundhed]) {
    for (const kilde of ["ai", "regel", "redaktør"] as const) {
      assert.ok(placementProblems(c, m[1], 0, kilde, ctx()).some((v) => v.code === "ai-begraenset"), `${c.kategoriSlug}/${kilde}`);
    }
  }
  // Uafhængig fra Krimi er fint.
  assert.equal(placementProblems(cand({ kategoriSlug: "krimi-og-retsvaesen" }), m[1], 0, "regel", ctx()).length, 0);
});

test("kvoteloft: nået loft blokerer alt kommercielt (også redaktør-pins)", () => {
  const m = layout([["grid", "top-grid"], ["pb", "partner-break"]]);
  const partner = cand({ indholdstype: "Partner" });
  assert.ok(placementProblems(partner, m[1], 0, "regel", ctx({ quotaExceeded: true })).some((v) => v.code === "kvoteloft"));
  assert.ok(placementProblems(partner, m[0], 0, "redaktør", ctx({ quotaExceeded: true })).some((v) => v.code === "kvoteloft"));
  assert.equal(placementProblems(partner, m[1], 0, "regel", ctx()).length, 0);
  for (const type of ["Partner", "Sponsoreret", "PR", "Annonce"]) {
    assert.ok(placementProblems(cand({ indholdstype: type }), m[0], 0, "redaktør", ctx({ quotaExceeded: true })).length > 0, type);
  }
});

test("kvoteloft: andelen af kommercielle placeringer begrænses til loftet; auto fjernes, redaktør bevares med advarsel", () => {
  assert.equal(commercialCap(13, 25), 3);
  assert.equal(commercialCap(4, 20), 0);
  const m = layout([["grid", "top-grid"], ["news", "seneste-nyt"], ["pb", "partner-break"], ["sb", "sponsoreret-break"]]); // 3 + 8 + 1 + 1 = 13 slots
  const editorial = Array.from({ length: 6 }, () => cand());
  const partner = cand({ indholdstype: "Partner" });
  const sponsor = cand({ indholdstype: "Sponsoreret" });
  const base = [...editorial.slice(0, 3).map((c, i) => asg(c, "grid", i)), ...editorial.slice(3).map((c, i) => asg(c, "news", i))];
  // Loft 5 % af 8 placeringer = 0 -> auto-kommercielle fjernes.
  const strict = run(m, [...base, asg(partner, "pb", 0), asg(sponsor, "sb", 0, "regel", { prioritet: 1 })], [...editorial, partner, sponsor], { kvoteloftProcent: 5 });
  assert.equal(strict.assignments.filter((a) => [partner.id, sponsor.id].includes(a.articleId)).length, 0);
  assert.equal(codes(strict).filter((c) => c === "kvoteloft").length, 2);
  // Redaktørens pin bevares (kun advarsel).
  const pinned = run(m, [...base, asg(partner, "pb", 0, "redaktør")], [...editorial, partner], { kvoteloftProcent: 5 });
  assert.equal(pinned.assignments.length, base.length + 1);
  assert.ok(pinned.violations.some((v) => v.code === "kvoteloft" && v.severity === "advarsel"));
  // Rimeligt loft lader begge boks-placeringer stå (7 + 2 = 9 -> 25 % = 2).
  const ok = run(m, [...base, asg(partner, "pb", 0), asg(sponsor, "sb", 0)], [...editorial, partner, sponsor]);
  assert.equal(ok.assignments.length, base.length + 2);
});

test("type-regler: partner-boks kun Partner; hero kun redaktionelt ved automatisk fyldning", () => {
  const m = layout([["hero", "hero"], ["pb", "partner-break"], ["bar", "breaking-bar"]]);
  const sponsor = cand({ indholdstype: "Sponsoreret" });
  assert.ok(placementProblems(sponsor, m[1], 0, "regel", ctx()).some((v) => v.code === "type-ikke-tilladt"));
  const pr = cand({ indholdstype: "PR" });
  assert.ok(placementProblems(pr, m[0], 0, "regel", ctx()).some((v) => v.code === "type-ikke-tilladt"));
  assert.ok(placementProblems(cand(), m[2], 0, "regel", ctx()).some((v) => v.code === "kun-breaking"));
  assert.equal(placementProblems(cand({ breaking: true }), m[2], 0, "regel", ctx()).length, 0);
});

test("diversitet: højst én artikel pr. emne i topzonen (hero + top-grid); redaktør bevares med advarsel", () => {
  const m = layout([["hero", "hero"], ["grid", "top-grid"]]);
  const a = cand({ emneKey: "lokalplan" });
  const b = cand({ emneKey: "lokalplan" });
  const c = cand({ emneKey: "fodbold" });
  const auto = run(m, [asg(a, "hero", 0), asg(b, "grid", 0), asg(c, "grid", 1)], [a, b, c]);
  assert.deepEqual(auto.assignments.map((x) => x.articleId), [a.id, c.id]);
  assert.ok(codes(auto).includes("diversitet"));
  const manual = run(m, [asg(a, "hero", 0, "redaktør"), asg(b, "grid", 0, "redaktør")], [a, b]);
  assert.equal(manual.assignments.length, 2);
  assert.ok(manual.violations.some((v) => v.code === "diversitet" && v.severity === "advarsel"));
  // Uden for topzonen gælder reglen ikke.
  const m2 = layout([["news", "seneste-nyt"]]);
  const d = cand({ emneKey: "x" });
  const e = cand({ emneKey: "x" });
  assert.equal(run(m2, [asg(d, "news", 0), asg(e, "news", 1)], [d, e]).assignments.length, 2);
});

test("friskhed: gamle artikler afvises automatisk; redaktør og godkendt snapshot (skipFreshness) er undtaget", () => {
  const m = layout([["grid", "top-grid"]]);
  const old = cand({ publiceretTid: hoursAgo(100) });
  assert.ok(codes(run(m, [asg(old, "grid", 0)], [old])).includes("friskhed"));
  assert.equal(run(m, [asg(old, "grid", 0, "redaktør")], [old]).assignments.length, 1);
  assert.equal(run(m, [asg(old, "grid", 0)], [old], {}, true).assignments.length, 1);
  const configured = layout([["grid", "top-grid", { config: { maxAgeHours: 200 } }]]);
  assert.equal(run(configured, [asg(old, "grid", 0)], [old]).assignments.length, 1);
});

test("dubletter og ugyldige slots/moduler/artikler afvises; én artikel kun ét sted (undtagen breaking-bar)", () => {
  const m = layout([["hero", "hero"], ["grid", "top-grid"], ["bar", "breaking-bar"]]);
  const a = cand({ breaking: true });
  const r = run(m, [asg(a, "hero", 0), asg(a, "grid", 0), asg(a, "bar", 0)], [a]);
  assert.deepEqual(r.assignments.map((x) => x.moduleId), ["hero", "bar"], "bjælken er en peger og må dublere");
  assert.ok(codes(r).includes("dublet"));

  const b = cand();
  const bad = run(m, [asg(b, "grid", 9), asg(b, "findes-ikke", 0), asg(cand(), "grid", 1)], [b]);
  assert.equal(bad.assignments.length, 0);
  assert.ok(codes(bad).includes("slot-ugyldigt") && codes(bad).includes("modul-ukendt") && codes(bad).includes("ukendt-artikel"));
  // Samme slot to gange.
  const c = cand();
  const d = cand();
  assert.equal(run(m, [asg(c, "grid", 0), asg(d, "grid", 0)], [c, d]).assignments.length, 1);
});

test("ugyldig variant rettes til modulets standard; begrundelse kappes til 200 tegn", () => {
  const m = layout([["hero", "hero"]]);
  const a = cand();
  const r = run(m, [asg(a, "hero", 0, "ai", { variant: "tekstlinje", begrundelse: "x".repeat(500) })], [a]);
  assert.equal(r.assignments[0].variant, "hero");
  assert.equal(r.assignments[0].begrundelse.length, 200);
});

test("redaktørens placering vinder over AI ved dublet; resultat sorteres efter layout", () => {
  const m = layout([["hero", "hero"], ["grid", "top-grid"]]);
  const a = cand();
  const r = run(m, [asg(a, "grid", 0, "ai"), asg(a, "hero", 0, "redaktør")], [a]);
  assert.equal(r.assignments.length, 1);
  assert.equal(r.assignments[0].moduleId, "hero");
});

test("tomme slots rapporteres som advarsler (breaks og breaking-bar må være tomme)", () => {
  const m = layout([["bar", "breaking-bar"], ["grid", "top-grid"], ["pb", "partner-break"]]);
  const a = cand();
  const warns = findEmptySlots(m, [asg(a, "grid", 0)]);
  assert.equal(warns.length, 2);
  assert.ok(warns.every((w) => w.code === "tom-slot" && w.moduleId === "grid"));
});
