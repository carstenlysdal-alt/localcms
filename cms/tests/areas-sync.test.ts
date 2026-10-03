import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { db } from "../lib/db";
import { allDefaultAreas, defaultAreasFor, type DefaultArea } from "../lib/default-areas";
import { applyAreaSync, planAreaSync } from "../lib/default-areas-sync";
import { ALL_NETWORK_SITES } from "../lib/network-sites";
import { isAsciiSlug } from "../lib/slug";
import { NETWORK_SITES } from "../prisma/network-seed-data";
import { parseArgs, syncAreas } from "../scripts/sync-areas";
import { createInstance } from "./helpers/mock-session";

const names = (areas: DefaultArea[]) => areas.map((a) => a.navn);

test("standardområder: alle seks byer, ASCII-slugs, unikke navne og slugs pr. by", () => {
  const all = allDefaultAreas();
  assert.deepEqual(Object.keys(all).sort(), ALL_NETWORK_SITES.map((s) => s.domaene).sort());
  for (const [domain, areas] of Object.entries(all)) {
    assert.ok(areas.length >= 8, domain);
    assert.equal(new Set(areas.map((a) => a.slug)).size, areas.length, `${domain}: unikke slugs`);
    assert.equal(new Set(areas.map((a) => a.navn.toLowerCase())).size, areas.length, `${domain}: unikke navne`);
    for (const a of areas) {
      assert.ok(isAsciiSlug(a.slug), `${domain}/${a.slug} er ASCII`);
      assert.match(a.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  }
});

test("standardområder: Næstved og Slagelse får de små byer fra kilderegistrene", () => {
  const naestved = names(defaultAreasFor("naestvedlokalt.dk"));
  for (const n of ["Næstved By", "Karrebæksminde", "Fuglebjerg", "Glumsø", "Fensmark", "Herlufmagle", "Holme-Olstrup", "Mogenstrup", "Tappernøje", "Sandved", "Toksværd", "Enø", "Suså"]) {
    assert.ok(naestved.includes(n), `Næstved: ${n}`);
  }
  const slagelse = names(defaultAreasFor("slagelselokalt.dk"));
  for (const n of ["Slagelse By", "Korsør", "Skælskør", "Antvorskov", "Halsskov", "Stigsnæs", "Dalmose", "Vemmelev", "Boeslunde", "Agersø", "Omø"]) {
    assert.ok(slagelse.includes(n), `Slagelse: ${n}`);
  }
  assert.deepEqual(defaultAreasFor("ukendt.dk"), []);
});

test("koordinater: kun hvor seed-dataene har dem — aldrig opfundet (nye steder har lat/lng = null)", () => {
  for (const cfg of NETWORK_SITES) {
    const defaults = defaultAreasFor(cfg.domaene);
    for (const seeded of cfg.areas) {
      const d = defaults.find((x) => x.slug === seeded.slug);
      assert.ok(d, `${cfg.domaene}/${seeded.slug}`);
      assert.equal(d.lat, seeded.lat);
      assert.equal(d.lng, seeded.lng);
    }
    for (const d of defaults.filter((x) => !cfg.areas.some((a) => a.slug === x.slug))) {
      assert.equal(d.lat, null, `${cfg.domaene}/${d.slug} må ikke have opfundne koordinater`);
      assert.equal(d.lng, null);
    }
  }
  const nullOnes = defaultAreasFor("slagelselokalt.dk").filter((d) => d.lat === null).map((d) => d.slug);
  assert.deepEqual(nullOnes.sort(), ["antvorskov", "halsskov", "stigsnaes"]);
  assert.deepEqual(defaultAreasFor("naestvedlokalt.dk").filter((d) => d.lat === null).map((d) => d.slug).sort(), ["enoe", "herlufmagle", "sandved", "susaa", "toksvaerd"]);
});

test("Slagelses standardområder passer til seed-databasens (prisma/seed.ts) uden at ændre noget", async () => {
  const inst = await db.instance.findFirstOrThrow({ where: { domaene: "slagelselokalt.dk" } });
  const existing = await db.geoTag.findMany({ where: { instansId: inst.id } });
  assert.ok(existing.length >= 8);
  const plan = planAreaSync(existing, defaultAreasFor(inst.domaene));
  assert.deepEqual(plan.conflicts, []);
  for (const e of existing.filter((g) => defaultAreasFor(inst.domaene).some((d) => d.slug === g.slug))) {
    const d = defaultAreasFor(inst.domaene).find((x) => x.slug === e.slug)!;
    assert.equal(e.navn, d.navn);
    assert.equal(e.lat, d.lat, `${e.slug} lat`);
    assert.equal(e.lng, d.lng, `${e.slug} lng`);
  }
  assert.deepEqual(plan.create.map((a) => a.slug).sort(), ["antvorskov", "halsskov", "stigsnaes"], "kun de nye små byer skal oprettes");
});

test("planAreaSync: tom instans får alt; idempotent; navne-/slug-konflikter oprettes ikke og røres ikke", () => {
  const defaults: DefaultArea[] = [
    { navn: "A By", slug: "a-by", lat: 1, lng: 2 },
    { navn: "Bø", slug: "boe", lat: null, lng: null },
    { navn: "Cæ", slug: "cae", lat: null, lng: null },
  ];
  assert.equal(planAreaSync([], defaults).create.length, 3);
  const withExisting = planAreaSync(
    [
      { id: "1", navn: "A By", slug: "a-by" },
      { id: "2", navn: "bø", slug: "gammel-boe" }, // samme navn (case-insensitivt), anden slug -> konflikt
      { id: "3", navn: "Noget andet", slug: "cae" }, // samme slug, andet navn -> konflikt
    ],
    defaults,
  );
  assert.deepEqual(withExisting.unchanged, ["a-by"]);
  assert.equal(withExisting.create.length, 0);
  assert.deepEqual(withExisting.conflicts.map((c) => c.slug).sort(), ["boe", "cae"]);
  assert.equal(planAreaSync([], [...defaults, defaults[0]]).conflicts.length, 1, "dublet i standardlisten rapporteres");
});

let a = "";
let b = "";
before(async () => {
  a = (await createInstance("AreaA")).id;
  b = (await createInstance("AreaB")).id;
});
after(async () => {
  await db.geoTag.deleteMany({ where: { instansId: { in: [a, b] } } });
  await db.instance.deleteMany({ where: { id: { in: [a, b] } } });
  await db.$disconnect();
});

test("applyAreaSync: opretter, bevarer eksisterende uændret, er idempotent og rører ikke andre instanser", async () => {
  const defaults: DefaultArea[] = [
    { navn: "Alfa", slug: "alfa", lat: 55.1, lng: 11.1 },
    { navn: "Beta", slug: "beta", lat: null, lng: null },
    { navn: "Gamma", slug: "gamma", lat: null, lng: null },
  ];
  // Eksisterende område med afvigende navn/koordinater må ikke ændres (heller ikke lat/lng = null)
  await db.geoTag.create({ data: { instansId: a, navn: "Alfa", slug: "alfa", lat: null, lng: null } });
  await db.instance.update({ where: { id: a }, data: { geografiskDækning: ["Alfa"] } });

  const plan = planAreaSync(await db.geoTag.findMany({ where: { instansId: a }, select: { id: true, navn: true, slug: true } }), defaults);
  assert.deepEqual(plan.create.map((x) => x.slug), ["beta", "gamma"]);
  assert.equal(await applyAreaSync(db, a, plan), 2);

  const rows = await db.geoTag.findMany({ where: { instansId: a }, orderBy: { slug: "asc" } });
  assert.deepEqual(rows.map((r) => r.slug), ["alfa", "beta", "gamma"]);
  assert.equal(rows[0].lat, null, "eksisterende Alfa er uændret (får ikke standardens koordinater)");
  assert.equal(rows[1].lat, null, "ingen opfundne koordinater");
  assert.deepEqual((await db.instance.findUniqueOrThrow({ where: { id: a } })).geografiskDækning, ["Alfa", "Beta", "Gamma"]);

  const again = planAreaSync(await db.geoTag.findMany({ where: { instansId: a }, select: { id: true, navn: true, slug: true } }), defaults);
  assert.equal(again.create.length, 0, "idempotent");
  assert.equal(await applyAreaSync(db, a, again), 0);
  assert.equal(await db.geoTag.count({ where: { instansId: b } }), 0, "tenant-isolation");
});

test("syncAreas (script-kerne): tørkørsel skriver intet; --apply opretter kun for den valgte instans; ukendt instans afvises", async () => {
  // Kør mod en kopi af Næstved-domænet kan ikke ske uden at ramme seed-instansen, så brug domæne-opslag på en ny instans.
  const target = await db.instance.create({ data: { navn: "NæstvedTest", domaene: "naestvedlokalt.dk", geografiskDækning: [], kategoriTaksonomi: [], markingTekster: {} } });
  try {
    const seeded = await db.instance.findFirstOrThrow({ where: { domaene: "naestvedlokalt.dk", id: { not: target.id } } });
    const before = await db.geoTag.count({ where: { instansId: seeded.id } });

    const dry = await syncAreas(db, { apply: false, all: false, target: target.id });
    assert.equal(dry.length, 1);
    assert.equal(dry[0].plan.create.length, defaultAreasFor("naestvedlokalt.dk").length);
    assert.equal(dry[0].created, 0);
    assert.equal(await db.geoTag.count({ where: { instansId: target.id } }), 0, "tørkørsel skriver intet");

    const applied = await syncAreas(db, { apply: true, all: false, target: target.id });
    assert.equal(applied[0].created, defaultAreasFor("naestvedlokalt.dk").length);
    assert.equal(await db.geoTag.count({ where: { instansId: seeded.id } }), before, "anden instans med samme domæne er urørt");
    const slugs = (await db.geoTag.findMany({ where: { instansId: target.id } })).map((g) => g.slug);
    for (const s of ["herlufmagle", "sandved", "toksvaerd", "enoe", "susaa", "karrebaeksminde"]) assert.ok(slugs.includes(s), s);

    const second = await syncAreas(db, { apply: true, all: false, target: target.id });
    assert.equal(second[0].created, 0, "idempotent");
  } finally {
    await db.geoTag.deleteMany({ where: { instansId: target.id } });
    await db.instance.delete({ where: { id: target.id } });
  }
  await assert.rejects(() => syncAreas(db, { apply: false, all: false, target: "findes-ikke" }), /Ingen instans/);
});

test("parseArgs (sync-areas)", () => {
  assert.deepEqual(parseArgs(["--alle"]), { apply: false, all: true, target: undefined });
  assert.deepEqual(parseArgs(["--instans", "naestvedlokalt.dk", "--apply"]), { apply: true, all: false, target: "naestvedlokalt.dk" });
  assert.throws(() => parseArgs([]), /Brug/);
  assert.throws(() => parseArgs(["--instans"]), /mangler/);
  assert.throws(() => parseArgs(["--instans", "--apply"]), /mangler/);
  assert.throws(() => parseArgs(["--alle", "--instans", "x"]), /ikke begge/);
});
