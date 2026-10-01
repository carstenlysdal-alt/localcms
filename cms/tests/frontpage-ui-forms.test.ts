import assert from "node:assert/strict";
import test from "node:test";
import { configFields, formToConfig, formValuesFromModule } from "../app/redaktion/forside/_lib/config-fields";
import { updateModule } from "../app/redaktion/forside/_lib/layout-ops";
import { describeOp } from "../app/redaktion/forside/_lib/describe-ops";
import { MODULE_LIST } from "../lib/frontpage/modules";
import { defaultLayoutModules, applyTemplate } from "../lib/frontpage/templates";
import { applyOps, validateOps } from "../lib/frontpage/nl-commands";

const ctx = { sections: [{ value: "sport", label: "Sport" }], areas: [{ value: "karrebaeksminde", label: "Karrebæksminde" }] };

test("konfigurationsfelter genereres af modulets tilladte nøgler; breaks/placement redigeres ikke her", () => {
  for (const def of MODULE_LIST) {
    const fields = configFields(def.id, ctx);
    for (const f of fields) assert.ok((def.allowedConfigKeys as readonly string[]).includes(f.key), `${def.id}.${f.key}`);
    assert.ok(!fields.some((f) => f.key === "breaks" || f.key === "placement"));
  }
  const keys = (t: Parameters<typeof configFields>[0]) => configFields(t, ctx).map((f) => f.key);
  assert.deepEqual(keys("hero").sort(), ["maxAgeHours", "omraadeSlug", "sektionSlug", "titel"]);
  assert.ok(keys("sektion-rail").includes("sektionSlug"));
  assert.ok(keys("ad-break").includes("adFormat"));
  assert.ok(keys("egen-promo").includes("promoKind"));
  assert.ok(keys("fra-politiet").includes("sourceTypes"));
  assert.ok(!keys("kalender-strip").includes("maxAgeHours"));
});

test("formular -> config: tomme værdier fjernes, tal valideres, ukendte nøgler ignoreres", () => {
  const r = formToConfig("sektion-rail", { sektionSlug: "sport", titel: "  Sportsnyt ", maxAgeHours: "48", promoKind: "stoet" });
  assert.deepEqual(r.config, { sektionSlug: "sport", titel: "Sportsnyt", maxAgeHours: 48 }); // promoKind ikke tilladt for sektion-rail
  assert.deepEqual(formToConfig("hero", { titel: "", sektionSlug: "" }).config, {});
  assert.ok(formToConfig("hero", { maxAgeHours: "0" }).errors.maxAgeHours);
  assert.ok(formToConfig("hero", { maxAgeHours: "1.5" }).errors.maxAgeHours);
  assert.deepEqual(formToConfig("fra-politiet", { sourceTypes: ["politi"] }).config, { sourceTypes: ["politi"] });
});

test("formular -> layout: updateModule med formular-config giver gyldigt layout og bevarer breaks", () => {
  const withBreak = applyTemplate([], "top-med-annonce-break", {}, "replace");
  assert.ok(withBreak.ok);
  if (!withBreak.ok) return;
  const { config } = formToConfig("top-grid", { titel: "Vigtigst nu", maxAgeHours: "24" });
  const res = updateModule(withBreak.value, "top-grid", { slots: 5, variant: "kompakt", config });
  assert.ok(res.ok);
  if (res.ok) {
    const m = res.modules.find((x) => x.id === "top-grid")!;
    assert.equal(m.slots, 5);
    assert.equal(m.variant, "kompakt");
    assert.equal(m.config.titel, "Vigtigst nu");
    assert.equal(m.config.breaks?.length, 1, "break-reference bevares");
  }
  // ugyldig variant for modulet afvises med dansk besked
  const bad = updateModule(withBreak.value, "hero", { variant: "liste" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /understøtter ikke/);
  // formularværdier kan læses tilbage
  const back = formValuesFromModule(res.ok ? res.modules.find((x) => x.id === "top-grid")! : withBreak.value[0]);
  assert.equal(back.titel, "Vigtigst nu");
});

test("tilstand forslag/auto og synlighed ændres via updateModule uden at røre mærkning (ingen label-felt findes)", () => {
  const m = defaultLayoutModules();
  const r = updateModule(m, "hero", { mode: "auto", visible: false });
  assert.ok(r.ok);
  if (r.ok) {
    const h = r.modules.find((x) => x.id === "hero")!;
    assert.deepEqual([h.mode, h.visible], ["auto", false]);
  }
  // forsøg på at smugle skjul-mærkning ind via config afvises af schema
  const smuggled = updateModule(m, "hero", { config: { hideLabel: true } as never });
  assert.equal(smuggled.ok, false);
});

test("AI-operationer beskrives på dansk og kan anvendes på kopien (eksemplet: sponsoreret boks efter tredje historie)", () => {
  const modules = defaultLayoutModules();
  const { ops, rejected } = validateOps([
    { op: "pin_article", articleId: "art-politik-1", moduleId: "hero", slotIndex: 0 },
    { op: "add_break", hostModuleId: "top-grid", afterSlot: 3, breakType: "sponsoreret-break" },
    { op: "publish_layout" },
  ]);
  assert.equal(ops.length, 2);
  assert.equal(rejected.length, 1);
  const lines = ops.map((o) => describeOp(o, modules, { "art-politik-1": "Budgetforlig" }));
  assert.match(lines[0], /Fastgør "Budgetforlig" i Hero/);
  assert.match(lines[1], /Sponsoreret boks-break efter slot 3 i Top-grid/);
  const res = applyOps(modules, ops, { candidateIds: new Set(["art-politik-1"]) });
  assert.equal(res.rejected.length, 0);
  assert.equal(res.modules.find((m) => m.id === "top-grid")?.config.breaks?.[0].afterSlot, 3);
  assert.equal(res.pins[0].articleId, "art-politik-1");
});

test("tomme-slot-advarsler samles pr. modul; øvrige advarsler bevares", async () => {
  const { collapseEmptySlots, groupViolations, layoutHints, violationTitle } = await import("../app/redaktion/forside/_lib/hints");
  const vs = [2, 3, 4, 5].map((i) => ({ code: "tom-slot" as const, severity: "advarsel" as const, besked: "x", moduleId: "seneste-nyt", slotIndex: i }));
  const out = collapseEmptySlots([{ code: "kvoteloft", severity: "blokerende", besked: "Loft nået" }, ...vs, { code: "tom-slot", severity: "advarsel", besked: "y", moduleId: "top-grid", slotIndex: 1 }], (id) => (id === "seneste-nyt" ? "Seneste nyt" : id));
  assert.equal(out.length, 3);
  assert.match(out.find((v) => v.moduleId === "seneste-nyt")!.besked, /Seneste nyt: 4 tomme slots \(slot 3–6\)/);
  assert.match(out.find((v) => v.moduleId === "top-grid")!.besked, /1 tomt slot \(slot 2\)/);
  assert.equal(groupViolations(out).blokerende.length, 1);
  assert.equal(violationTitle({ code: "ai-hero" }), "AI-assisteret i hero");
  const hints = layoutHints(defaultLayoutModules().filter((m) => m.type !== "hero"));
  assert.ok(hints.some((h) => h.includes("ingen synlig hero")));
  assert.ok(layoutHints(defaultLayoutModules().map((m) => ({ ...m, mode: "auto" as const }))).some((h) => h.includes("Auto er endnu ikke aktivt")));
});
