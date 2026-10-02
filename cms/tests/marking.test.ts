import assert from "node:assert/strict";
import test from "node:test";
import { validateMarking, CONTENT_TYPES } from "../lib/marking";

test("alle fem mærkede indholdstyper afvises uden påkrævede felter", () => {
  // Uafhængig er gyldig uden ekstra felter
  assert.equal(validateMarking("Uafhængig", null).success, true);

  // Partner kræver sponsor, labelTekst
  assert.equal(validateMarking("Partner", null).success, false);
  assert.equal(validateMarking("Partner", { sponsor: "", labelTekst: "Partnerindhold" }).success, false);

  // Sponsoreret kræver sponsor, labelTekst
  assert.equal(validateMarking("Sponsoreret", null).success, false);
  assert.equal(validateMarking("Sponsoreret", { sponsor: "A/S", labelTekst: "" }).success, false);

  // Brugerindsendt kræver afsender
  assert.equal(validateMarking("Brugerindsendt", null).success, false);
  assert.equal(validateMarking("Brugerindsendt", { afsender: "" }).success, false);

  // PR kræver afsender
  assert.equal(validateMarking("PR", null).success, false);
  assert.equal(validateMarking("PR", { afsender: "" }).success, false);

  // AI-assisteret kræver godkendtAf og kilder
  assert.equal(validateMarking("AI-assisteret", null).success, false);
  assert.equal(validateMarking("AI-assisteret", { godkendtAf: "Redaktør", kilder: [] }).success, false);
  assert.equal(validateMarking("AI-assisteret", { godkendtAf: "", kilder: ["https://kilde.dk"] }).success, false);
});

test("alle fem mærkede indholdstyper accepteres med korrekte felter", () => {
  assert.equal(
    validateMarking("Partner", { sponsor: "Sparekassen", labelTekst: "Finansieret af Sparekassen", aftaleId: "sa-1" }).success,
    true
  );

  assert.equal(
    validateMarking("Sponsoreret", { sponsor: "Bilcenter", labelTekst: "ANNONCE" }).success,
    true
  );

  assert.equal(
    validateMarking("Brugerindsendt", { afsender: "Korsør Løbeklub" }).success,
    true
  );

  assert.equal(
    validateMarking("PR", { afsender: "Slagelse Erhvervsråd" }).success,
    true
  );

  assert.equal(
    validateMarking("AI-assisteret", {
      godkendtAf: "Carsten Lysdal",
      kilder: ["https://slagelse.dk/dagsorden-2026-09-29"],
    }).success,
    true
  );
});

test("CONTENT_TYPES indeholder alle seks gyldige typer", () => {
  assert.deepEqual(CONTENT_TYPES, [
    "Uafhængig",
    "Partner",
    "Sponsoreret",
    "Brugerindsendt",
    "AI-assisteret",
    "PR",
  ]);
});

// ── T6 / T5: partner-aftaleId, AI-brug og AI-spærring ──────────────────────────────────────────

import { AI_USE_NONE, isAiRestrictedCategory, isAiRestrictedCategoryTree, normalizeAiUse, usesAi } from "../lib/marking";

test("T6 nr. 2: Partner kræver aftaleId (tom, mellemrum og manglende afvises)", () => {
  const base = { sponsor: "Eksempel Partner A", labelTekst: "Finansieret af Eksempel Partner A" };
  assert.equal(validateMarking("Partner", base).success, false, "uden aftaleId");
  assert.equal(validateMarking("Partner", { ...base, aftaleId: "" }).success, false);
  assert.equal(validateMarking("Partner", { ...base, aftaleId: "   " }).success, false);
  const res = validateMarking("Partner", { ...base, aftaleId: "sa-1" });
  assert.equal(res.success, true);
  assert.match(String((validateMarking("Partner", base) as { error?: string }).error), /aftaleId/);
  // Sponsoreret kræver stadig ikke aftaleId
  assert.equal(validateMarking("Sponsoreret", { sponsor: "Eksempel Partner B", labelTekst: "Annonce" }).success, true);
});

test("T6 nr. 8: normalizeAiUse kræver aktivt valg ved publicering, og 'Ingen' kan ikke kombineres", () => {
  assert.deepEqual(normalizeAiUse([AI_USE_NONE], { requireChoice: true }), { ok: true, value: ["Ingen"] });
  assert.deepEqual(normalizeAiUse(["Udkast", "Udkast", " Sproglig korrektur "], { requireChoice: true }), { ok: true, value: ["Udkast", "Sproglig korrektur"] });
  assert.equal(normalizeAiUse([], { requireChoice: true }).ok, false);
  assert.deepEqual(normalizeAiUse([], { requireChoice: false }), { ok: true, value: [] }, "kladde uden valg er tilladt");
  assert.equal(normalizeAiUse(["Ingen", "Udkast"], { requireChoice: false }).ok, false);
  assert.equal(normalizeAiUse(["Magi"], { requireChoice: false }).ok, false);
  assert.equal(usesAi(["Ingen"]), false);
  assert.equal(usesAi([]), false);
  assert.equal(usesAi(undefined), false);
  assert.equal(usesAi(["Sproglig korrektur"]), true);
});

test("T5 P2-7: AI-spærringen følger hele forældrekæden og kan ikke omgås ved omdøbning af barnet", () => {
  assert.equal(isAiRestrictedCategory({ slug: "krimi-og-retsvaesen", navn: "Hvad som helst" }), true);
  assert.equal(isAiRestrictedCategory({ slug: "sundhed", navn: "Trivsel" }), true);
  assert.equal(isAiRestrictedCategory({ slug: "noget", navn: "Krimi i hverdagen" }), true);
  assert.equal(isAiRestrictedCategory({ slug: "politik", navn: "Politik" }), false);
  assert.equal(isAiRestrictedCategory(null), false);

  const child = { slug: "lokale-sager", navn: "Lokale sager", parent: { slug: "krimi-og-retsvaesen", navn: "Krimi og retsvæsen" } };
  assert.equal(isAiRestrictedCategory(child), false, "enkelt-kategori-tjekket ser kun barnet");
  assert.equal(isAiRestrictedCategoryTree(child), true, "træ-tjekket ser forælderen");
  assert.equal(isAiRestrictedCategoryTree({ slug: "x", navn: "x", parent: { slug: "y", navn: "y", parent: { slug: "sundhed", navn: "Sundhed" } } }), true, "også bedsteforælder");
  assert.equal(isAiRestrictedCategoryTree({ slug: "politik", navn: "Politik", parent: { slug: "nyheder", navn: "Nyheder" } }), false);
  assert.equal(isAiRestrictedCategoryTree(null), false);
  // Cyklus i data giver ikke en uendelig løkke
  const loop: { slug: string; navn: string; parent?: unknown } = { slug: "a", navn: "a" };
  loop.parent = loop;
  assert.equal(isAiRestrictedCategoryTree(loop as never), false);
});
