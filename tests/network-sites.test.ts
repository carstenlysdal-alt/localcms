import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { parseSiteColors, getCurrentSite, getAllNetworkSites } from "../lib/site";

const db = new PrismaClient();

const EXPECTED_SITES = [
  { domain: "slagelselokalt.dk", navn: "SlagelseLokalt", accent: "#9E3D1B" },
  { domain: "naestvedlokalt.dk", navn: "NæstvedLokalt", accent: "#1F5663" },
  { domain: "holbaeklokalt.dk", navn: "HolbækLokalt", accent: "#4F5B1E" },
  { domain: "ringstedlokalt.dk", navn: "RingstedLokalt", accent: "#8A5A00" },
  { domain: "koegelokalt.dk", navn: "KøgeLokalt", accent: "#24533A" },
  { domain: "roskildelokalt.dk", navn: "RoskildeLokalt", accent: "#6A3553" },
];

test("Alle 6 hovedsites eksisterer i databasen med korrekte domæner og navne", async () => {
  const instances = await db.instance.findMany();
  assert.equal(instances.length >= 6, true, "Der skal mindst være 6 instanser oprettet");

  for (const expected of EXPECTED_SITES) {
    const inst = instances.find((i) => i.domaene === expected.domain);
    assert.ok(inst, `Instans med domæne ${expected.domain} skal findes`);
    assert.equal(inst.navn, expected.navn);

    const colors = parseSiteColors(inst.farver);
    assert.equal(colors.accent.toLowerCase(), expected.accent.toLowerCase());
  }
});

test("Hver instans har 5 søstersites i netvaerk-feltet", async () => {
  for (const expected of EXPECTED_SITES) {
    const inst = await db.instance.findFirst({
      where: { domaene: expected.domain },
    });
    assert.ok(inst);
    const netvaerk = Array.isArray(inst.netvaerk) ? (inst.netvaerk as Array<{ domaene: string }>) : [];
    assert.equal(netvaerk.length, 5, `${inst.navn} skal have præcis 5 søstersites`);
    assert.equal(netvaerk.some((s) => s.domaene === expected.domain), false, "Sitet må ikke indeholde sig selv i søsterlisten");
  }
});

test("Hvert hovedsite har tilknyttede områder (GeoTags) og kategorier", async () => {
  for (const expected of EXPECTED_SITES) {
    const inst = await db.instance.findFirst({
      where: { domaene: expected.domain },
      include: {
        geoTags: true,
        categories: true,
        articles: { where: { status: "Publiceret" } },
      },
    });
    assert.ok(inst);
    assert.equal(inst.geoTags.length, 8, `${inst.navn} skal have 8 definerede delområder`);
    assert.equal(inst.categories.length >= 6, true, `${inst.navn} skal have sektioner oprettet`);
    assert.equal(inst.articles.length >= 10, true, `${inst.navn} skal have mindst 10 publicerede artikler`);
  }
});

test("getCurrentSite med overrideHost returnerer korrekte data for alle 6 sites", async () => {
  for (const expected of EXPECTED_SITES) {
    const site = await getCurrentSite(expected.domain);
    assert.equal(site.domaene, expected.domain);
    assert.equal(site.navn, expected.navn);
    assert.equal(site.colors.accent.toLowerCase(), expected.accent.toLowerCase());
    assert.ok(site.tagline && site.tagline.length > 5, "Sitet skal have en meningsfuld tagline");
    assert.ok(site.kommune && site.kommune.length > 2, "Sitet skal have et kommunenavn");
  }
});

test("getAllNetworkSites returnerer alle 6 netværkssites", async () => {
  const sites = await getAllNetworkSites();
  assert.equal(sites.length >= 6, true);
  for (const expected of EXPECTED_SITES) {
    assert.ok(sites.some((s) => s.domaene === expected.domain));
  }
});
