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
