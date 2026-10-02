import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { calculateSupportedContentQuota } from "../lib/frontpage-governance";
import { adBreakAllowance } from "../lib/frontpage/guardrails";
import type { ModuleInstance } from "../lib/frontpage/layout-schema";
import { MODULE_REGISTRY } from "../lib/frontpage/modules";
import { publicSignalWhere } from "../lib/frontpage/signals";
import { defaultLayoutModules, instantiateTemplate } from "../lib/frontpage/templates";
import { COMMERCIAL_TYPES, isCommercialType } from "../lib/frontpage/types";
import { addModule } from "../app/redaktion/forside/_lib/layout-ops";
import { createInstance, createUser, installNextMocks, session, uniq } from "./helpers/mock-session";

installNextMocks();

let instansId = "";
let otherInstansId = "";
let omraadeA = "";
let omraadeB = "";
const HOUR = 3_600_000;
const ids: Record<string, string> = {};

const mod = (type: "fra-politiet" | "fra-kommunen", config: ModuleInstance["config"] = {}): ModuleInstance => ({ id: type, type, slots: 5, region: "full", visible: true, mode: "forslag", config });

before(async () => {
  instansId = (await createInstance("Sig")).id;
  otherInstansId = (await createInstance("Sig2")).id;
  omraadeA = (await db.geoTag.create({ data: { instansId, navn: "Område A", slug: "omraade-a" } })).id;
  omraadeB = (await db.geoTag.create({ data: { instansId, navn: "Område B", slug: "omraade-b" } })).id;
  const mk = async (key: string, over: Record<string, unknown>) => {
    const row = await db.signal.create({
      data: { instansId, overskrift: `Signal ${key}`, kilde: "Test", kildeUrl: `https://example.com/${key}`, maskinindsamlet: true, sourceType: "politi", kildeTidspunkt: new Date(Date.now() - HOUR), ...over },
    });
    ids[key] = row.id;
  };
  const approved = { godkendtAf: "u1", godkendtTid: new Date() };
  await mk("politi-ugodkendt", {});
  await mk("politi-godkendt", { ...approved });
  await mk("politi-gammelt", { ...approved, kildeTidspunkt: new Date(Date.now() - 30 * HOUR) });
  await mk("112-godkendt", { ...approved, sourceType: "beredskab_112" });
  await mk("politi-omraade-a", { ...approved, omraadeId: omraadeA });
  await mk("politi-omraade-b", { ...approved, omraadeId: omraadeB });
  await mk("kommune-godkendt", { ...approved, sourceType: "kommune_dagsorden", kildeTidspunkt: new Date(Date.now() - 48 * HOUR) });
  await mk("kommune-ugodkendt", { sourceType: "kommune_dagsorden" });
  await mk("kommune-for-gammelt", { ...approved, sourceType: "kommune_dagsorden", kildeTidspunkt: new Date(Date.now() - 100 * HOUR) });
  await mk("manuelt-signal", { ...approved, maskinindsamlet: false });
  await mk("uden-kildetid-ny", { ...approved, kildeTidspunkt: null });
  await db.signal.create({ data: { instansId: otherInstansId, overskrift: "Anden instans", kilde: "Test", maskinindsamlet: true, sourceType: "politi", kildeTidspunkt: new Date(), godkendtAf: "u9", godkendtTid: new Date() } });
});

after(async () => {
  await db.article.deleteMany({ where: { instansId: { in: [instansId, otherInstansId] } } });
  await db.signal.deleteMany({ where: { instansId: { in: [instansId, otherInstansId] } } });
  await db.geoTag.deleteMany({ where: { instansId } });
  await db.user.deleteMany({ where: { instansId: { in: [instansId, otherInstansId] } } });
  await db.instance.deleteMany({ where: { id: { in: [instansId, otherInstansId] } } });
});

async function visibleKeys(m: ModuleInstance) {
  const rows = await db.signal.findMany({ where: publicSignalWhere(instansId, m) });
  const byId = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
  return rows.map((r) => byId[r.id]).sort();
}

test("T5 P1-3: kun redaktørgodkendte signaler vises — politi/112 aldrig uden godkendelse", async () => {
  const police = await visibleKeys(mod("fra-politiet"));
  assert.ok(!police.includes("politi-ugodkendt"), "ugodkendt politisignal vises aldrig");
  assert.deepEqual(police, ["112-godkendt", "politi-godkendt", "politi-omraade-a", "politi-omraade-b", "uden-kildetid-ny"].sort());
  assert.ok(!police.includes("manuelt-signal"), "kun maskinindsamlede signaler");
  const kommune = await visibleKeys(mod("fra-kommunen"));
  assert.ok(!kommune.includes("kommune-ugodkendt"));
  assert.deepEqual(kommune, ["kommune-godkendt"], "kommunale signaler: kun godkendte og inden for 72 t");
});

test("T7 §5: aldersgrænse (24 t politi / 72 t kommune, konfigurerbar) og område-filter respekteres", async () => {
  assert.equal(MODULE_REGISTRY["fra-politiet"].maxAgeHours, 24);
  assert.equal(MODULE_REGISTRY["fra-kommunen"].maxAgeHours, 72);
  assert.ok(!(await visibleKeys(mod("fra-politiet"))).includes("politi-gammelt"), "30 t gammelt politisignal er for gammelt");
  assert.ok((await visibleKeys(mod("fra-politiet", { maxAgeHours: 48 }))).includes("politi-gammelt"), "config.maxAgeHours udvider vinduet");
  assert.ok((await visibleKeys(mod("fra-kommunen", { maxAgeHours: 120 }))).includes("kommune-for-gammelt"));
  assert.deepEqual(await visibleKeys(mod("fra-politiet", { omraadeSlug: "omraade-a" })), ["politi-omraade-a"], "omraadeSlug begrænser forespørgslen");
  assert.deepEqual(await visibleKeys(mod("fra-politiet", { omraadeSlug: "findes-ikke" })), []);
  assert.deepEqual(await visibleKeys(mod("fra-politiet", { sourceTypes: ["beredskab_112"] })), ["112-godkendt"]);
  // Aldrig på tværs af instanser
  const rows = await db.signal.findMany({ where: publicSignalWhere(instansId, mod("fra-politiet")) });
  assert.ok(rows.every((r) => r.instansId === instansId));
});

test("T7 §5: signalmoduler er skjulte som standard (skabelon og tilføj-modul), øvrige moduler er synlige", () => {
  const tpl = instantiateTemplate("fra-kommunen-politiet");
  assert.ok(tpl.ok);
  if (tpl.ok) {
    assert.equal(tpl.value.length, 2);
    for (const m of tpl.value) assert.equal(m.visible, false, `${m.type} skal være skjult som standard`);
  }
  for (const type of ["fra-kommunen", "fra-politiet"] as const) {
    const res = addModule(defaultLayoutModules(), type);
    assert.ok(res.ok);
    if (res.ok) assert.equal(res.modules.find((m) => m.type === type)?.visible, false, `addModule(${type})`);
  }
  const added = addModule(defaultLayoutModules(), "kalender-strip");
  assert.ok(added.ok);
  if (added.ok) assert.equal(added.modules.find((m) => m.type === "kalender-strip")?.visible, true);
  assert.ok(defaultLayoutModules().every((m) => m.visible), "standardforsiden er uændret");
});

test("loadExtras henter kun godkendte signaler for synlige signalmoduler", async () => {
  const { loadExtras } = await import("../components/site/frontpage/data");
  const extras = await loadExtras(instansId, [mod("fra-politiet")]);
  const titles = (extras.signals["fra-politiet"] ?? []).map((s) => s.overskrift);
  assert.ok(titles.length > 0);
  assert.ok(!titles.includes("Signal politi-ugodkendt"));
  assert.ok(titles.includes("Signal politi-godkendt"));
  const hidden = await loadExtras(instansId, [{ ...mod("fra-politiet"), visible: false }]);
  assert.deepEqual(hidden.signals, {}, "skjult modul henter intet");
});

test("signal-godkendelse kræver signal.approve (DB-opslag), er tenant-bundet og kan trækkes tilbage", async () => {
  const actions = await import("../app/redaktion/signaler/actions");
  const leader = await createUser(instansId, "Redaktionsleder");
  const freelancer = await createUser(instansId, "Freelancejournalist");
  const foreignEditor = await createUser(otherInstansId, "Ansvarshavende redaktør");

  session.userId = freelancer.id;
  session.staleJwtPermissions = ["signal.approve"];
  assert.equal((await actions.approveSignal(ids["politi-ugodkendt"])).ok, false, "forfatter kan ikke godkende (forældet JWT hjælper ikke)");
  session.staleJwtPermissions = [];
  assert.equal((await db.signal.findUniqueOrThrow({ where: { id: ids["politi-ugodkendt"] } })).godkendtTid, null);

  session.userId = foreignEditor.id;
  assert.equal((await actions.approveSignal(ids["politi-ugodkendt"])).ok, false, "fremmed instans: signalet findes ikke");
  assert.equal((await db.signal.findUniqueOrThrow({ where: { id: ids["politi-ugodkendt"] } })).godkendtTid, null);

  session.userId = leader.id;
  assert.equal((await actions.approveSignal(ids["politi-ugodkendt"])).ok, true);
  const approved = await db.signal.findUniqueOrThrow({ where: { id: ids["politi-ugodkendt"] } });
  assert.equal(approved.godkendtAf, leader.id);
  assert.ok(approved.godkendtTid);
  assert.ok((await visibleKeys(mod("fra-politiet"))).includes("politi-ugodkendt"), "efter godkendelse vises signalet");

  assert.equal((await actions.revokeSignalApproval(ids["politi-ugodkendt"])).ok, true);
  assert.ok(!(await visibleKeys(mod("fra-politiet"))).includes("politi-ugodkendt"), "tilbagetrukket godkendelse skjuler signalet igen");

  session.userId = freelancer.id;
  assert.equal((await actions.revokeSignalApproval(ids["politi-godkendt"])).ok, false);
  assert.ok((await db.signal.findUniqueOrThrow({ where: { id: ids["politi-godkendt"] } })).godkendtTid);

  await db.user.deleteMany({ where: { id: { in: [leader.id, freelancer.id, foreignEditor.id] } } });
});

test("signal.approve ligger i Ansvarshavende redaktør og Redaktionsleder, ikke i øvrige roller", async () => {
  const roles = await db.role.findMany();
  const holders = roles.filter((r) => (r.permissions as string[]).includes("signal.approve")).map((r) => r.navn).sort();
  assert.deepEqual(holders, ["Ansvarshavende redaktør", "Redaktionsleder"]);
});

test("T6 nr. 18-20: ÉN fælles definition af kommercielt indhold og annoncer tæller i kvoteloftet", async () => {
  assert.deepEqual([...COMMERCIAL_TYPES].sort(), ["Annonce", "PR", "Partner", "Sponsoreret"]);
  for (const t of ["Partner", "Sponsoreret", "PR", "Annonce"]) assert.equal(isCommercialType(t), true, t);
  for (const t of ["Uafhængig", "Brugerindsendt", "AI-assisteret"]) assert.equal(isCommercialType(t), false, t);

  // 7-dages-kvoten (lib/frontpage-governance) tæller PR, Partner, Sponsoreret og Annonce — samme som rækværket.
  const make = (indholdstype: string) => db.article.create({ data: { titel: `K ${indholdstype}`, slug: uniq("k"), blocks: [], aiBrug: [], status: "Publiceret", publiceretTid: new Date(), indholdstype, instansId } });
  for (const t of ["Uafhængig", "Uafhængig", "PR", "Partner", "Sponsoreret", "Annonce", "Brugerindsendt", "AI-assisteret"]) await make(t);
  await db.instance.update({ where: { id: instansId }, data: { kvoteloftProcent: 50 } });
  const q = await calculateSupportedContentQuota(instansId);
  assert.equal(q.totalCount, 8);
  assert.equal(q.supportedCount, 4, "PR, Partner, Sponsoreret og Annonce");
  assert.equal(q.percentage, 50);
  assert.equal(q.isExceeded, true);
  await db.instance.update({ where: { id: instansId }, data: { kvoteloftProcent: 25 } });
});

test("annoncer (ad-break) tæller som kommerciel placering: adBreakAllowance", () => {
  // 8 artikelslots, 0 kommercielle, loft 25 %: maks. 2 annoncer ((0+n) <= floor((8+n)*0,25) -> n=2: 2 <= 2)
  assert.equal(adBreakAllowance({ filledArticleSlots: 8, commercialArticleSlots: 0, adUnits: 4, kvoteloftProcent: 25, quotaExceeded: false }), 2);
  // Et partnerbrud fylder allerede loftet op: ingen annoncer
  assert.equal(adBreakAllowance({ filledArticleSlots: 8, commercialArticleSlots: 2, adUnits: 4, kvoteloftProcent: 25, quotaExceeded: false }), 0);
  assert.equal(adBreakAllowance({ filledArticleSlots: 8, commercialArticleSlots: 1, adUnits: 4, kvoteloftProcent: 25, quotaExceeded: false }), 1);
  // 7-dages-kvoten er nået: ingen annoncer overhovedet
  assert.equal(adBreakAllowance({ filledArticleSlots: 20, commercialArticleSlots: 0, adUnits: 3, kvoteloftProcent: 25, quotaExceeded: true }), 0);
  // Færre annoncer end tilladt: alle vises
  assert.equal(adBreakAllowance({ filledArticleSlots: 20, commercialArticleSlots: 0, adUnits: 2, kvoteloftProcent: 25, quotaExceeded: false }), 2);
  assert.equal(adBreakAllowance({ filledArticleSlots: 0, commercialArticleSlots: 0, adUnits: 3, kvoteloftProcent: 25, quotaExceeded: false }), 0, "tom forside kan ikke bære annoncer");
  assert.equal(adBreakAllowance({ filledArticleSlots: 8, commercialArticleSlots: 0, adUnits: 0, kvoteloftProcent: 25, quotaExceeded: false }), 0);
});

test("limitAdsByQuota begrænser de viste annoncer i forsiden", async () => {
  const { limitAdsByQuota } = await import("../components/site/frontpage/data");
  const ad = (n: number) => ({ id: `ad-${n}`, titel: `Annonce ${n}`, annoncoer: "Eksempel", format: "IN_FEED_BANNER", placeringZone: "feed", kreativData: {} });
  const mods: ModuleInstance[] = [
    { id: "top-grid", type: "top-grid", slots: 6, region: "full", visible: true, mode: "forslag", config: {} },
    { id: "ad-break", type: "ad-break", slots: 1, region: "full", visible: true, mode: "forslag", config: { placement: "sequence" } },
    { id: "ad-break-2", type: "ad-break", slots: 1, region: "full", visible: true, mode: "forslag", config: { placement: "sequence" } },
    { id: "ad-break-3", type: "ad-break", slots: 1, region: "full", visible: true, mode: "forslag", config: { placement: "sequence" } },
  ];
  const assignments = Array.from({ length: 6 }, (_, i) => ({ moduleId: "top-grid", slotIndex: i, articleId: `a${i}`, variant: "kort" as const, kilde: "regel" as const, prioritet: 3, begrundelse: "", konfidens: null, locked: false, label: { tekst: "", synlig: true as const } }));
  const articles = Object.fromEntries(assignments.map((a) => [a.articleId, { indholdstype: "Uafhængig" }]));
  const extras = { ads: [ad(1), ad(2), ad(3)], calendar: [], board: [], signals: {}, sectionNames: {} };

  await db.instance.update({ where: { id: instansId }, data: { kvoteloftProcent: 25 } });
  // De 8 publicerede artikler fra forrige test ligger i 7-dages-vinduet; en kvote under loftet kræver få kommercielle. Ryd dem.
  await db.article.deleteMany({ where: { instansId } });
  const limited = await limitAdsByQuota(instansId, mods, assignments, articles, extras);
  assert.equal(limited.ads.length, 2, "6 artikelslots + 25 % -> højst 2 annoncer (2 <= floor(8*0,25))");

  const withPartner = { ...articles, a0: { indholdstype: "Partner" } };
  const limited2 = await limitAdsByQuota(instansId, mods, assignments, withPartner, extras);
  assert.equal(limited2.ads.length, 0, "et partnerbrud fylder allerede loftet (1 + n <= floor((6 + n) * 25 %) giver ingen n)");

  // Uden ad-break-moduler eller annoncer ændres intet
  assert.equal((await limitAdsByQuota(instansId, mods.slice(0, 1), assignments, articles, extras)).ads.length, 3);
  assert.equal((await limitAdsByQuota(instansId, mods, assignments, articles, { ...extras, ads: [] })).ads.length, 0);

  // Kvoten (7 dage) er nået -> ingen annoncer
  await db.instance.update({ where: { id: instansId }, data: { kvoteloftProcent: 0 } });
  await db.article.create({ data: { titel: "K", slug: uniq("k"), blocks: [], aiBrug: [], status: "Publiceret", publiceretTid: new Date(), indholdstype: "Partner", instansId } });
  const none = await limitAdsByQuota(instansId, mods, assignments, articles, extras);
  assert.equal(none.ads.length, 0);
});
