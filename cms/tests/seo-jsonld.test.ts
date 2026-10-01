// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;
import assert from "node:assert/strict";
import test from "node:test";
import {
  articleGraph,
  articleSchemaType,
  breadcrumbList,
  eventNode,
  isNewsSitemapEligible,
  newsArticleNode,
  offerCatalog,
  organizationNode,
  profilePage,
  siteGraph,
  creditLabel,
  guessAgentType,
} from "../lib/seo/jsonld";
import { resolveSeoConfig } from "../lib/seo/config";
import { safeJsonLd } from "../lib/seo/escape";
import { absoluteUrl, articlePath, slugCandidates, siteBase } from "../lib/seo/url";
import { isoWithOffset } from "../lib/seo/time";

const site = { domaene: "naestvedlokalt.dk", navn: "NæstvedLokalt", kommune: "Næstved", tagline: "Din lokale stemme" };
const base = siteBase(site);
const cfg = resolveSeoConfig({ ...site, logoUrl: null, sideTekster: null }, {} as NodeJS.ProcessEnv);

const baseArticle = {
  titel: "Næstved Byråd tilfører 14 millioner </script>",
  manchet: "<p>Kort <strong>fortalt</strong></p>",
  slug: "byraad-skole",
  indholdstype: "Uafhængig",
  publiceretTid: new Date("2026-10-01T01:39:33Z"),
  opdateretTid: new Date("2026-10-01T07:39:33Z"),
  sektion: { navn: "Nyheder", slug: "nyheder" },
  forfatter: { navn: "Morten Kaas", slug: "morten-kaas" },
  tags: [{ navn: "Byråd" }],
  geoTags: [{ navn: "Næstved By", slug: "naestved-by", lat: 55.23, lng: 11.76 }],
  cover: { altTekst: "Rådhus", ophavsperson: "Jens" },
};

test("absoluteUrl og siteBase", () => {
  assert.equal(siteBase({ domaene: "www.Naestvedlokalt.dk" }), "https://naestvedlokalt.dk");
  assert.equal(absoluteUrl(base, "/"), "https://naestvedlokalt.dk/");
  assert.equal(absoluteUrl(base, "/nyheder"), "https://naestvedlokalt.dk/nyheder");
  assert.equal(absoluteUrl(base, "https://x.dk/a"), "https://x.dk/a");
  assert.equal(articlePath("nyheder", "døgn"), "/nyheder/d%C3%B8gn");
});

test("slugCandidates dækker rå, afkodet og NFC/NFD", () => {
  const c = slugCandidates("d%C3%B8gnrapport");
  assert.ok(c.includes("døgnrapport"));
  assert.ok(c.includes("døgnrapport".normalize("NFD")));
});

test("isoWithOffset giver dansk offset (sommer/vinter)", () => {
  assert.equal(isoWithOffset(new Date("2026-10-01T03:39:33Z")), "2026-10-01T05:39:33+02:00");
  assert.equal(isoWithOffset(new Date("2026-01-15T10:00:00Z")), "2026-01-15T11:00:00+01:00");
  assert.equal(isoWithOffset(null), undefined);
});

test("NewsArticle har alle krævede felter og kun absolutte URL'er", () => {
  const n = newsArticleNode(baseArticle, site, cfg, base) as Rec;
  assert.equal(n["@type"], "NewsArticle");
  for (const k of ["headline", "image", "datePublished", "dateModified", "author", "publisher", "mainEntityOfPage", "inLanguage", "articleSection", "isAccessibleForFree"]) {
    assert.ok(n[k] !== undefined, `mangler ${k}`);
  }
  assert.equal(n.inLanguage, "da-DK");
  assert.equal(n.image.length, 3);
  for (const img of n.image) assert.ok(img.startsWith("https://naestvedlokalt.dk/og/artikel/"));
  assert.ok(!JSON.stringify(n).includes('"/')); // ingen relative URL'er som værdi
  assert.equal(n.author.url, "https://naestvedlokalt.dk/forfatter/morten-kaas");
  assert.equal(n.creditText, "Foto: Jens");
  // JSON-LD output er sikkert
  const out = safeJsonLd(articleGraph(baseArticle, site, cfg, base));
  assert.ok(!out.includes("</script"));
});

test("mapping indholdstype -> schema", () => {
  const t = (indholdstype: string, extra: Record<string, unknown> = {}, marking: Record<string, unknown> = {}) =>
    newsArticleNode({ ...baseArticle, indholdstype, marking, ...extra }, site, cfg, base) as Rec;

  const partner = t("Partner", {}, { sponsor: "Sparekassen", labelTekst: "x" });
  assert.equal(partner["@type"], "NewsArticle");
  assert.equal(partner.sponsor.name, "Sparekassen");

  const spons = t("Sponsoreret", { forfatter: null }, { sponsor: "Bilcenter" });
  assert.equal(spons["@type"], "Article");
  assert.equal(spons.author.name, "Bilcenter");
  assert.equal(spons.sponsor.name, "Bilcenter");

  const bruger = t("Brugerindsendt", {}, { afsender: "Tappernøje Borgerforening" });
  assert.equal(bruger["@type"], "Article");
  assert.equal(bruger.author["@type"], "Organization");
  assert.equal(bruger.contributor.name, "NæstvedLokalt");

  const pr = t("PR", {}, { afsender: "Næstved Kommune" });
  assert.equal(pr.author["@type"], "Organization");
  assert.equal(pr.provider.name, "Næstved Kommune");

  const ai = t("AI-assisteret", {}, { godkendtAf: "Morten Kaas", kilder: ["https://naestved.dk/a", "Byrådssekretariat"] });
  assert.equal(ai["@type"], "NewsArticle");
  assert.deepEqual(ai.isBasedOn, ["https://naestved.dk/a"]);
  assert.deepEqual(ai.citation, ["Byrådssekretariat"]);
  assert.equal(ai.editor.name, "Morten Kaas");
  assert.match(ai.backstory, /AI/);

  const debat = newsArticleNode({ ...baseArticle, sektion: { navn: "Debat", slug: "debat" } }, site, cfg, base) as Rec;
  assert.equal(debat["@type"], "OpinionNewsArticle");
  assert.equal(articleSchemaType({ indholdstype: "Uafhængig", sektion: { navn: "x", slug: "nyheder" } }), "NewsArticle");
});

test("kun Uafhængig og AI-assisteret kvalificerer til news-sitemap", () => {
  assert.equal(isNewsSitemapEligible("Uafhængig"), true);
  assert.equal(isNewsSitemapEligible("AI-assisteret"), true);
  for (const t of ["Partner", "Sponsoreret", "PR", "Brugerindsendt"]) assert.equal(isNewsSitemapEligible(t), false);
});

test("Organization udelader logo/sameAs når de ikke er konfigureret og udsender aldrig tomme strenge", () => {
  const org = organizationNode(site, cfg, base) as Rec;
  assert.equal(org.logo, undefined);
  assert.equal(org.sameAs, undefined);
  assert.equal(org.publishingPrinciples, "https://naestvedlokalt.dk/om-mediet/redaktionelle-principper");
  assert.equal(org.correctionsPolicy, "https://naestvedlokalt.dk/om-mediet/rettelser");
  const parsed = JSON.parse(safeJsonLd(siteGraph(site, cfg, base)));
  assert.ok(!JSON.stringify(parsed).includes('""'));
  assert.equal(parsed["@graph"][1]["@type"], "WebSite");
  assert.equal(parsed["@graph"][1].potentialAction["@type"], "SearchAction");
});

test("Organization får logo og sameAs når de er konfigureret (kun gyldige URL'er)", () => {
  const env = {
    SEO_SITE_CONFIG: JSON.stringify({
      "naestvedlokalt.dk": { sameAs: ["https://www.facebook.com/x", "ikke-en-url"], logoUrl: "/logo.png", logoWidth: 512, logoHeight: 512, twitterSite: "naestvedlokalt" },
    }),
  } as unknown as NodeJS.ProcessEnv;
  const c = resolveSeoConfig({ ...site, logoUrl: null, sideTekster: null }, env);
  assert.deepEqual(c.sameAs, ["https://www.facebook.com/x"]);
  assert.equal(c.twitterSite, "@naestvedlokalt");
  const org = organizationNode(site, c, base) as Rec;
  assert.equal(org.logo.url, "https://naestvedlokalt.dk/logo.png");
  assert.deepEqual(org.sameAs, ["https://www.facebook.com/x"]);
});

test("BreadcrumbList er absolut og dropper mellemled uden href", () => {
  const b = breadcrumbList(
    [
      { label: "Forside", href: "/" },
      { label: "Områder" },
      { label: "Fensmark" },
    ],
    base,
  ) as Rec;
  assert.equal(b.itemListElement.length, 2);
  assert.equal(b.itemListElement[0].item, "https://naestvedlokalt.dk/");
  assert.equal(b.itemListElement[1].item, undefined);
  assert.equal(b.itemListElement[1].position, 2);
});

test("ProfilePage, Event og OfferCatalog", () => {
  const p = profilePage({ slug: "morten-kaas", navn: "Morten Kaas", bio: "<p>Redaktør</p>", profilbilledeUrl: "/avatars/x.svg" }, base) as Rec;
  assert.equal(p["@type"], "ProfilePage");
  assert.equal(p.mainEntity.image, undefined); // SVG udelades
  assert.equal(p.mainEntity.description, "Redaktør");

  const e = eventNode({ slug: "fiskefestival", navn: "Fiskefestival", start: new Date("2026-10-03T08:00:00Z"), gratis: true, sted: { navn: "Havnen", by: "Karrebæksminde" } }, base) as Rec;
  assert.equal(e["@type"], "Event");
  assert.equal(e.startDate, "2026-10-03T10:00:00+02:00");
  assert.equal(e.offers.price, "0");
  assert.equal(e.url, "https://naestvedlokalt.dk/kalender/fiskefestival");

  const o = offerCatalog({ name: "Priser", offers: [{ name: "Event", price: 125 }, { name: "Profil", price: 249, perMonth: true }] }, site, base) as Rec;
  assert.equal(o.itemListElement[0].price, "125");
  assert.equal(o.itemListElement[1].priceSpecification.unitText, "MON");
});

test("creditLabel og guessAgentType", () => {
  assert.equal(creditLabel("Jens Hansen"), "Foto: Jens Hansen");
  assert.equal(creditLabel("Arkivfoto"), "Arkivfoto");
  assert.equal(guessAgentType("Tappernøje Borgerforening"), "Organization");
  assert.equal(guessAgentType("Anna Jensen"), "Person");
});
