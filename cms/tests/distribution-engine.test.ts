import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDecay,
  calculateDaypartBonus,
  calculateArticleScore,
  distributeArticles,
  ArticleDistributionInput,
} from "../lib/distribution-engine";

test("calculateDecay beregner korrekt halveringstid for nyheder og baggrund", () => {
  // Breaking de første 3 timer
  assert.equal(calculateDecay(1, true, "nyheder"), 1.0);
  assert.equal(calculateDecay(3, true, "nyheder"), 1.0);
  assert.ok(calculateDecay(10, true, "nyheder") < 1.0);

  // Normal nyhed halveres efter ca. 12 timer
  const decay12h = calculateDecay(12, false, "nyheder");
  assert.ok(Math.abs(decay12h - 0.5) < 0.05, `Forventede ca. 0.5, fik ${decay12h}`);

  // Kulturartikel holder længere (36 timer halvering)
  const decayKultur12h = calculateDecay(12, false, "kultur");
  assert.ok(decayKultur12h > decay12h, "Kulturartikel bør have højere decay end nyhed efter 12 timer");
});

test("calculateDaypartBonus tildeler dynamisk bonus efter døgnrytme", () => {
  // Morgen (kl. 8): Nyheder får bonus
  assert.equal(calculateDaypartBonus(8, "nyheder"), 25);
  assert.equal(calculateDaypartBonus(8, "kultur"), 0);

  // Middag (kl. 12): Erhverv og debat får bonus
  assert.equal(calculateDaypartBonus(12, "erhverv"), 20);
  assert.equal(calculateDaypartBonus(12, "debat"), 20);

  // Aften (kl. 19): Kultur og sport får bonus
  assert.equal(calculateDaypartBonus(19, "kultur"), 25);
  assert.equal(calculateDaypartBonus(19, "sport"), 25);
  assert.equal(calculateDaypartBonus(19, "nyheder"), 0);
});

test("calculateArticleScore tildeler fordelingsscore med geobonus og redaktionelt veto", () => {
  const now = new Date();

  const breakingArt: ArticleDistributionInput = {
    id: "art-1",
    titel: "Stor brand i Slagelse",
    publiceretTid: now,
    indholdstype: "Uafhængig",
    breaking: true,
    pinned: false,
    sektionSlug: "nyheder",
    omraadeSlug: "slagelse-by",
    visninger: 500,
    laesninger: 400,
    totalLaesetidSek: 24000,
  };

  const breakingScore = calculateArticleScore(breakingArt, { now, currentHour: 8 });
  assert.ok(breakingScore.totalScore > 300, "Breaking news bør have høj score");

  // Korsør-artikel får geoBonus
  const regionalArt: ArticleDistributionInput = {
    id: "art-2",
    titel: "Ny havnepromenade i Korsør",
    publiceretTid: now,
    indholdstype: "Uafhængig",
    breaking: false,
    pinned: false,
    sektionSlug: "nyheder",
    omraadeSlug: "korsoer",
    visninger: 100,
    laesninger: 70,
    totalLaesetidSek: 4200,
  };

  const regionalScore = calculateArticleScore(regionalArt, { now, currentHour: 8 });
  assert.equal(regionalScore.geoBonus, 15, "Områder uden for Slagelse By skal modtage geobonus");
});

test("distributeArticles overholder kvoteloft for betalt indhold", () => {
  const now = new Date();
  const articles: ArticleDistributionInput[] = [
    {
      id: "1",
      titel: "Nyhed 1",
      publiceretTid: now,
      indholdstype: "Uafhængig",
      breaking: true,
      pinned: false,
      sektionSlug: "nyheder",
      visninger: 100,
      laesninger: 50,
      totalLaesetidSek: 2500,
    },
    {
      id: "2",
      titel: "Sponsoreret artikel 1",
      publiceretTid: now,
      indholdstype: "Sponsoreret",
      breaking: false,
      pinned: true,
      sektionSlug: "erhverv",
      visninger: 200,
      laesninger: 150,
      totalLaesetidSek: 9000,
    },
    {
      id: "3",
      titel: "Partner artikel 2",
      publiceretTid: now,
      indholdstype: "Partner",
      breaking: false,
      pinned: true,
      sektionSlug: "erhverv",
      visninger: 180,
      laesninger: 140,
      totalLaesetidSek: 8400,
    },
    {
      id: "4",
      titel: "Nyhed 2",
      publiceretTid: now,
      indholdstype: "Uafhængig",
      breaking: false,
      pinned: false,
      sektionSlug: "nyheder",
      visninger: 50,
      laesninger: 20,
      totalLaesetidSek: 1000,
    },
    {
      id: "5",
      titel: "Nyhed 3",
      publiceretTid: now,
      indholdstype: "Uafhængig",
      breaking: false,
      pinned: false,
      sektionSlug: "sport",
      visninger: 60,
      laesninger: 30,
      totalLaesetidSek: 1500,
    },
  ];

  const result = distributeArticles(articles, 25);
  // I top 5 er der 2 kommercielle artikler ud af 5 (40%)
  assert.equal(result.commercialRatioPercent, 40);
  assert.equal(result.quotaAlert, true, "Skal advare når andelen overstiger kvoteloftet på 25%");
});
