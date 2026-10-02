import assert from "node:assert/strict";
import test from "node:test";
import { db } from "../lib/db";
import { geoKey, matchGeo, POSTNR_TABLE, resolveGeo, type GeoTagRef } from "../lib/ingest/geo";

const tags: GeoTagRef[] = [
  { id: "t-by", navn: "Næstved By", slug: "naestved-by" },
  { id: "t-karre", navn: "Karrebæksminde", slug: "karrebaeksminde" },
  { id: "t-glum", navn: "Glumsø", slug: "glumsoe" },
  { id: "t-nord", navn: "Køge Nord", slug: "koege-nord" },
  { id: "t-koege", navn: "Køge By", slug: "koege-by" },
  { id: "t-merl", navn: "St. Merløse", slug: "store-merloese" },
];

test("geo: præcis slug vinder, så navn, så normaliseret navn ('Næstved' -> 'Næstved By')", () => {
  assert.equal(matchGeo(tags, { omraade: "naestved-by" }, null).via, "slug");
  assert.equal(matchGeo(tags, { omraade: "Karrebæksminde" }, null).omraadeId, "t-karre");
  assert.equal(matchGeo(tags, { omraade: "Karrebæksminde" }, null).via, "slug", "translitteret navn = slug");
  assert.equal(matchGeo(tags, { omraade: "St. Merløse" }, null).via, "navn", "navn der ikke er slug");
  const r = matchGeo(tags, { by: "Næstved" }, null);
  assert.equal(r.omraadeId, "t-by");
  assert.equal(r.via, "normaliseret");
  assert.equal(matchGeo(tags, { kommune: "Næstved Kommune" }, null).omraadeId, "t-by");
  assert.equal(matchGeo(tags, "NÆSTVED BY", null).omraadeId, "t-by");
  assert.equal(matchGeo(tags, { by: "Glumsø" }, null).omraadeId, "t-glum");
  // Rækkefølgen af kandidater: omraade før by før kommune.
  assert.equal(matchGeo(tags, { omraade: "Karrebæksminde", by: "Næstved" }, null).omraadeId, "t-karre");
});

test("geo: normaliseret match skal være entydigt og må ikke gætte mellem 'Køge By' og 'Køge Nord'", () => {
  assert.equal(matchGeo(tags, { by: "Køge" }, null).omraadeId, "t-koege");
  const ambiguous: GeoTagRef[] = [{ id: "a", navn: "Ejby Nord", slug: "ejby-nord" }, { id: "b", navn: "Ejby By", slug: "ejby-by" }, { id: "c", navn: "Ejby", slug: "ejby" }];
  assert.equal(matchGeo(ambiguous, { by: "Ejby" }, null).omraadeId, "c", "præcist slug/navn først");
  const twins: GeoTagRef[] = [{ id: "a", navn: "Vest By", slug: "vest-by" }, { id: "b", navn: "Vest Kommune", slug: "vest-kommune" }];
  const r = matchGeo(twins, { by: "Vest" }, null);
  assert.equal(r.omraadeId, null, "to tags med samme normaliserede nøgle -> intet gæt");
  assert.match(r.omraadeTekst ?? "", /Vest/);
});

test("geo: postnummer slås op i instansens tabel; ukendt postnr giver tekst-hint, aldrig forkert tag", () => {
  assert.equal(matchGeo(tags, { postnr: "4700" }, "naestvedlokalt.dk").omraadeId, "t-by");
  assert.equal(matchGeo(tags, { postnr: "4700" }, "naestvedlokalt.dk").via, "postnr");
  assert.equal(matchGeo(tags, { postnr: "4736" }, "www.naestvedlokalt.dk").omraadeId, "t-karre");
  assert.equal(matchGeo(tags, "4171", "naestvedlokalt.dk").omraadeId, "t-glum", "postnummer som ren streng");
  // Samme postnummer i en anden instans peger ikke på denne instans' tag.
  assert.equal(matchGeo(tags, { postnr: "4700" }, "slagelselokalt.dk").omraadeId, null);
  const miss = matchGeo(tags, { omraade: "ukendt", postnr: "9999" }, "naestvedlokalt.dk");
  assert.equal(miss.omraadeId, null);
  assert.equal(miss.omraadeTekst, "ukendt / 9999");
  assert.equal(matchGeo(tags, undefined, null).omraadeId, null);
});

test("geoKey fjerner kun generiske tillægsord", () => {
  assert.equal(geoKey("Næstved By"), "naestved");
  assert.equal(geoKey("Næstved Kommune"), "naestved");
  assert.equal(geoKey("Holme-Olstrup"), "holme-olstrup");
  assert.equal(geoKey("By"), "by", "et navn der kun består af generiske ord bevares");
});

test("postnummertabellen peger kun på GeoTags der findes i seed-data, og postnumre er unikke pr. instans", async () => {
  for (const [domain, table] of Object.entries(POSTNR_TABLE)) {
    const instance = await db.instance.findFirst({ where: { domaene: domain }, include: { geoTags: true } });
    assert.ok(instance, `instans ${domain} findes i seed`);
    const slugs = new Set(instance.geoTags.map((g) => g.slug));
    for (const [postnr, slug] of Object.entries(table)) {
      assert.match(postnr, /^\d{4}$/);
      assert.ok(slugs.has(slug), `${domain}: GeoTag '${slug}' (postnr ${postnr}) findes ikke`);
    }
  }
});

test("resolveGeo mod databasen: postnr og normaliseret by virker i seedede instanser", async () => {
  const n = await db.instance.findFirstOrThrow({ where: { domaene: "naestvedlokalt.dk" } });
  const byTag = await db.geoTag.findFirstOrThrow({ where: { instansId: n.id, slug: "naestved-by" } });
  assert.equal((await resolveGeo(n.id, { by: "Næstved" })).omraadeId, byTag.id);
  assert.equal((await resolveGeo(n.id, { postnr: "4700" })).omraadeId, byTag.id);
  const s = await db.instance.findFirstOrThrow({ where: { domaene: "slagelselokalt.dk" } });
  const korsoer = await db.geoTag.findFirstOrThrow({ where: { instansId: s.id, slug: "korsoer" } });
  assert.equal((await resolveGeo(s.id, { postnr: "4220" })).omraadeId, korsoer.id);
  assert.equal((await resolveGeo(s.id, { postnr: "4700" })).omraadeId, null, "fremmed postnr rammer ikke et tag");
});
