import assert from "node:assert/strict";
import test from "node:test";
import { SERVICE_CODES, aiFailureMessage, isServiceCode, proposalResultMessage, serviceErrorMessage } from "../app/redaktion/forside/_lib/messages";
import { canPreview, parsePreviewTarget, previewDecision } from "../app/redaktion/forside/_lib/preview-access";
import { PERMISSIONS } from "../lib/permissions";

test("servicekoder -> danske beskeder (alle koder dækket, ukendt giver generisk fejl)", () => {
  for (const code of SERVICE_CODES) {
    const msg = serviceErrorMessage(code);
    assert.ok(msg.length > 10, code);
    assert.ok(/[æøåÆØÅ]|\s/.test(msg), `dansk tekst: ${code}`);
  }
  assert.equal(serviceErrorMessage("noget-helt-andet"), serviceErrorMessage("fejl"));
  assert.equal(serviceErrorMessage(undefined), serviceErrorMessage("fejl"));
  assert.ok(isServiceCode("rate-limited") && !isServiceCode("rate"));
  assert.match(serviceErrorMessage("conflict"), /Ændret af en anden/);
  assert.match(serviceErrorMessage("ai-unavailable"), /uden AI/);
  assert.match(serviceErrorMessage("layout-aendret"), /nyt forslag/);
});

test("AI-fejl og forslagsresultater giver klare beskeder uden rå serverfejl", () => {
  for (const r of ["ingen-noegle", "timeout", "ugyldig-json", "schema", "api-fejl", "tomt-svar"]) assert.ok(aiFailureMessage(r).length > 8, r);
  assert.equal(aiFailureMessage("ukendt"), "AI var utilgængelig.");
  const failed = proposalResultMessage({ reused: false, generatedBy: "deterministic", aiFailure: { reason: "timeout" }, assignmentCount: 12, wantedAi: true });
  assert.equal(failed.tone, "warn");
  assert.match(failed.text, /uden AI/);
  const ai = proposalResultMessage({ reused: false, generatedBy: "ai", aiFailure: null, assignmentCount: 12, wantedAi: true });
  assert.match(ai.text, /Intet er live, før du godkender/);
  assert.equal(proposalResultMessage({ reused: true, generatedBy: "ai", aiFailure: null, assignmentCount: 3, wantedAi: true }).tone, "info");
});

test("preview-rute: parametre og adgang (login, rettigheder, ugyldige id'er)", () => {
  assert.deepEqual(parsePreviewTarget({}), { kind: "live" });
  assert.deepEqual(parsePreviewTarget({ draft: "live" }), { kind: "live" });
  assert.deepEqual(parsePreviewTarget({ draft: "cmabc12345678" }), { kind: "draft", id: "cmabc12345678" });
  assert.deepEqual(parsePreviewTarget({ snapshot: "cmsnap12345678" }), { kind: "snapshot", id: "cmsnap12345678" });
  for (const bad of [{ draft: "../etc" }, { draft: "a b" }, { draft: "x" }, { draft: "a".repeat(80) }, { draft: "cmabc12345678", snapshot: "cmabc12345678" }, { snapshot: "<script>" }]) {
    assert.equal(parsePreviewTarget(bad).kind, "invalid", JSON.stringify(bad));
  }
  assert.equal(previewDecision(null, { draft: "live" }).allow, false);
  assert.deepEqual(previewDecision(null, {}), { allow: false, reason: "login" });
  assert.deepEqual(previewDecision({ permissions: ["article.create"] }, {}), { allow: false, reason: "forbidden" });
  assert.deepEqual(previewDecision({ permissions: [PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE] }, { draft: "nope!" }), { allow: false, reason: "invalid" });
  const ok = previewDecision({ permissions: [PERMISSIONS.FRONTPAGE_EDIT] }, { draft: "cmabc12345678" });
  assert.equal(ok.allow, true);
  for (const p of [PERMISSIONS.FRONTPAGE_EDIT, PERMISSIONS.FRONTPAGE_LAYOUT_MANAGE, PERMISSIONS.FRONTPAGE_SNAPSHOT_APPROVE]) assert.ok(canPreview({ permissions: [p] }));
  assert.equal(canPreview({ permissions: [PERMISSIONS.FRONTPAGE_AI_USE] }), false, "AI-rettighed alene giver ikke adgang til preview");
});
