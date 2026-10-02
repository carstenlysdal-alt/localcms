import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { db } from "../lib/db";
import { applyReplacements, fixDemoData, TEXT_REPLACEMENTS } from "../scripts/fix-demo-data";
import { createInstance, uniq } from "./helpers/mock-session";

const root = join(__dirname, "..");
const repoRoot = join(root, "..");

/** Rigtige varemærker/organisationer og opdigtede kilde-URL'er der ikke må stå i seed/demo (T6 nr. 28-29). */
const FORBIDDEN = [
  "Sparekassen Sjælland-Fyn", "spks.dk", "Harboe", "Novo Nordisk", "SuperBrugsen", "Vestsjællands Bilcenter", "vestbil.dk",
  "Munkholm Erhvervspark", "Slagelse Vin & Madkultur", "Realdania", "Roskilde Festival uddeler", "Klaus Mortensen",
  "slagelse.dk/presse", "slagelse.dk/politik", "politi.dk/midt-og-vestsjaellands", "udbud.dk/bekendtgoerelser", "dmi.dk/danmark",
  "Redaktionen har talt med", "Redaktionen på ${siteCfg.navn} har talt med", "har udtalt sig positivt", "Kommunal talsmand",
  "cms-demo-2026",
];

test("seed, netværksseed og statisk prototype indeholder ingen rigtige varemærker, opdigtede citater eller opdigtede kilde-URL'er", () => {
  const files = ["prisma/seed.ts", "prisma/network-seed-data.ts"].map((f) => [f, readFileSync(join(root, f), "utf8")] as const);
  files.push(["build_nyhedssite.py", readFileSync(join(repoRoot, "build_nyhedssite.py"), "utf8")]);
  files.push(["nyhedssite.html", readFileSync(join(repoRoot, "nyhedssite.html"), "utf8")]);
  for (const [name, text] of files) {
    for (const bad of FORBIDDEN) assert.ok(!text.includes(bad), `${name} indeholder stadig '${bad}'`);
  }
  const seed = files[0][1];
  assert.match(seed, /Eksempel Partner A/);
  assert.match(seed, /example\.com\/eksempel\/udtalelse/);
});

test("seed refererer ikke et GeoTag der ikke findes (antvorskov)", () => {
  const seed = readFileSync(join(root, "prisma/seed.ts"), "utf8");
  assert.ok(!/slug: "antvorskov"/.test(seed), "GeoTag 'antvorskov' findes ikke i areas");
});

test("fix-demo-data: erstatninger er idempotente og fjerner alle gamle navne", () => {
  for (const [from, to] of TEXT_REPLACEMENTS) {
    assert.equal(applyReplacements(from).includes(from) && !to.includes(from), false, `'${from}' erstattes`);
  }
  const sample = `Sparekassen Sjælland-Fyn og Harboe Bryggeri A/S — "Kommunal talsmand" https://slagelse.dk/presse/udtalelser-2026`;
  const once = applyReplacements(sample);
  assert.ok(!/Sparekassen|Harboe|Kommunal talsmand|slagelse\.dk\/presse/.test(once), once);
  assert.equal(applyReplacements(once), once, "idempotent");
  assert.match(applyReplacements('{"attribution":"Lokal talsperson, Næstved"}'), /Eksempel Talsperson \(fiktiv\)/);
  assert.match(applyReplacements("<p>Redaktionen på NæstvedLokalt har talt med kilder i naestved by, som understreger, at initiativet kan få mærkbar betydning for områdets fremtid.</p>"), /udfyldningstekst i demodata/);
});

test("fix-demo-data mod en database: retter gamle rækker og er idempotent (andet kørsel ændrer intet)", async () => {
  const inst = await createInstance("Demo");
  const slug = uniq("gammel");
  try {
    const org = await db.organization.create({ data: { navn: "Sparekassen Sjælland-Fyn", kontakt: "erhverv@spks.dk", instansId: inst.id } });
    const art = await db.article.create({
      data: {
        titel: "Sparekassen Sjælland-Fyn uddeler 250.000 kroner til lokale ungeprojekter", slug, aiBrug: [], instansId: inst.id,
        blocks: [{ id: "q", type: "quote", data: { quote: "Vi har arbejdet målrettet på at finde en balanceret løsning for hele kommunen.", attribution: "Kommunal talsmand", kildeUrl: "https://slagelse.dk/presse/udtalelser-2026", dato: "2026-09-29" } }],
        marking: { sponsor: "Sparekassen Sjælland-Fyn", labelTekst: "Finansieret af Sparekassen Sjælland-Fyn", aftaleId: "sa-sparekassen" },
      },
    });
    const dry = await fixDemoData(db, true);
    assert.ok(dry >= 2);
    assert.equal((await db.organization.findUniqueOrThrow({ where: { id: org.id } })).navn, "Sparekassen Sjælland-Fyn", "tør-kørsel ændrer intet");

    assert.ok((await fixDemoData(db)) >= 2);
    const o = await db.organization.findUniqueOrThrow({ where: { id: org.id } });
    assert.equal(o.navn, "Eksempel Partner A");
    assert.equal(o.kontakt, "kontakt@eksempel-partner-a.example");
    const a = await db.article.findUniqueOrThrow({ where: { id: art.id } });
    assert.equal(a.titel, "Eksempel Partner A støtter lokale ungeprojekter (demodata)");
    const quote = (a.blocks as Array<{ data: { quote: string; attribution: string; kildeUrl: string } }>)[0].data;
    assert.match(quote.quote, /eksempelcitat/);
    assert.equal(quote.attribution, "Eksempel Talsperson (fiktiv)");
    assert.equal(quote.kildeUrl, "https://example.com/eksempel/udtalelse");
    assert.equal((a.marking as { sponsor: string }).sponsor, "Eksempel Partner A");
    assert.equal((a.marking as { aftaleId: string }).aftaleId, "sa-sparekassen", "id-nøglen røres ikke");

    assert.equal(await fixDemoData(db), 0, "idempotent: intet at rette anden gang");
  } finally {
    await db.article.deleteMany({ where: { instansId: inst.id } });
    await db.organization.deleteMany({ where: { instansId: inst.id } });
    await db.instance.delete({ where: { id: inst.id } });
  }
});
