// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;
import assert from "node:assert/strict";
import test from "node:test";
import { articleMetaSchema, emptyMeta } from "../lib/article-meta";
import { resolveArticleSeo } from "../lib/seo/article-seo";
import { buildPageMetadata } from "../lib/seo/meta";
import { newsArticleNode } from "../lib/seo/jsonld";
import { resolveSeoConfig } from "../lib/seo/config";
import { safeJsonLd } from "../lib/seo/escape";
import { newsSitemapXml } from "../lib/seo/sitemap";
import { siteBase } from "../lib/seo/url";
import { buildPreviews, displayUrl } from "../lib/seo/preview";
import { computeSeoScore } from "../lib/editor/seo-score";
import { formatSavedAt, fromLocalInput, toLocalInput } from "../lib/editor/format";
import { initialFormState, toFormData } from "../lib/editor/form-state";
import { articleInputFromFormData, baseVersionFromFormData } from "../lib/article-form-input";
import { serializeMeta } from "../lib/article-meta";
import { listHref, parseListParams } from "../lib/editor/list-query";
import { blocksPlainText, countWords, readingMinutes } from "../lib/blocks/text";
import { articlePreviewDecision } from "../lib/editor/preview-access";
import { PERMISSIONS } from "../lib/permissions";

const site = { domaene: "naestvedlokalt.dk", navn: "NæstvedLokalt", kommune: "Næstved", tagline: "Din lokale stemme" };
const base = siteBase(site);
const cfg = resolveSeoConfig({ ...site, logoUrl: null, sideTekster: null }, {} as NodeJS.ProcessEnv);

const common = {
  base,
  titel: "Byrådet vedtager nyt budget for skolerne i Næstved",
  manchet: "<p>Kort fortalt: <strong>14 millioner</strong> går til skolerne.</p>",
  slug: "byraad-skole",
  sektion: { navn: "Nyheder", slug: "nyheder" },
};

test("fallbackkæder: ingen overrides -> titel/manchet/genereret kort; seo -> og; og -> twitter", () => {
  const plain = resolveArticleSeo({ ...common, version: 7 });
  assert.equal(plain.title, "Byrådet vedtager nyt budget for skolerne i Næstved");
  assert.equal(plain.description, "Kort fortalt: 14 millioner går til skolerne.");
  assert.equal(plain.canonical, `${base}/nyheder/byraad-skole`);
  assert.equal(plain.og.title, plain.og.title);
  assert.equal(plain.og.image.url, `${base}/og/artikel/byraad-skole.jpg?v=7`);
  assert.equal(plain.twitter.card, "summary_large_image");
  assert.equal(plain.twitter.title, plain.og.title);
  assert.equal(plain.twitter.image.url, plain.og.image.url);
  assert.equal(plain.locale, "da_DK");
  assert.equal(plain.noindex, false);

  const seo = resolveArticleSeo({ ...common, seoTitel: "SEO-titel her", seoBeskrivelse: "SEO-beskrivelse her" });
  assert.equal(seo.title, "SEO-titel her");
  assert.equal(seo.description, "SEO-beskrivelse her");
  assert.equal(seo.og.title, "SEO-titel her", "OG falder tilbage til SEO-titel");
  assert.equal(seo.og.description, "SEO-beskrivelse her");

  const full = resolveArticleSeo({
    ...common,
    seoTitel: "SEO",
    meta: articleMetaSchema.parse({ ogTitel: "OG-titel", ogBeskrivelse: "OG-tekst", twitterCard: "summary", twitterTitel: "X-titel", canonicalUrl: "https://andet.dk/original", robotsNoindex: true, robotsNofollow: true }),
    ogMedia: { url: "/uploads/og.jpg", altTekst: "OG-alt", bredde: 1200, hoejde: 630 },
    twitterMedia: { url: "/uploads/x.jpg" },
  });
  assert.equal(full.og.title, "OG-titel");
  assert.equal(full.og.description, "OG-tekst");
  assert.equal(full.og.image.url, `${base}/uploads/og.jpg`);
  assert.equal(full.og.image.width, 1200);
  assert.equal(full.twitter.card, "summary");
  assert.equal(full.twitter.title, "X-titel");
  assert.equal(full.twitter.description, "OG-tekst", "twitter-beskrivelse -> og-beskrivelse");
  assert.equal(full.twitter.image.url, `${base}/uploads/x.jpg`);
  assert.equal(full.canonical, "https://andet.dk/original");
  assert.equal(full.isCanonicalOverride, true);
  assert.equal(full.noindex, true);
  assert.equal(full.nofollow, true);

  // Ugyldig canonical-override ignoreres
  const bad = resolveArticleSeo({ ...common, meta: { canonicalUrl: "javascript:alert(1)" } });
  assert.equal(bad.canonical, `${base}/nyheder/byraad-skole`);
});

test("kladde uden cover: byens standardkort; kladde med cover: coverens URL (ingen ikke-eksisterende OG-rute)", () => {
  const noCover = resolveArticleSeo({ ...common, draft: true });
  assert.equal(noCover.og.image.url, `${base}/og/by.jpg`);
  const withCover = resolveArticleSeo({ ...common, draft: true, cover: { url: "/uploads/c.jpg", altTekst: "Cover" } });
  assert.equal(withCover.og.image.url, `${base}/uploads/c.jpg`);
});

test("buildPageMetadata: canonical, robots, keywords, news_keywords, og:locale, twitter og article:* fra artikelmetadata", async () => {
  const meta = articleMetaSchema.parse({
    keywords: ["Byråd", "Skole"], newsKeywords: ["Næstved", "Skole"], udloebTid: "2027-01-01T00:00:00Z", standout: true,
    robotsNoindex: true, canonicalUrl: "https://andet.dk/o", twitterCard: "summary", oversaettelser: { en: { url: "https://naestvedlokalt.dk/en/x" } },
  });
  const seo = resolveArticleSeo({ ...common, sprog: "en", meta });
  const m = await buildPageMetadata({
    site, path: "/nyheder/byraad-skole", title: seo.title, ogTitle: seo.og.title, description: "d", ogDescription: seo.og.description, type: "article",
    noindex: seo.noindex, canonicalUrl: seo.isCanonicalOverride ? seo.canonical : undefined, locale: seo.locale, keywords: seo.keywords, newsKeywords: seo.newsKeywords,
    unavailableAfter: seo.unavailableAfter, standout: seo.standout, languages: seo.languages, image: seo.og.image,
    twitter: { card: seo.twitter.card, title: seo.twitter.title, description: seo.twitter.description, image: seo.twitter.image },
    article: { publishedTime: new Date("2026-10-01T01:00:00Z"), modifiedTime: new Date("2026-10-01T02:00:00Z"), expirationTime: meta.udloebTid },
  }) as Rec;
  assert.equal(m.alternates.canonical, "https://andet.dk/o");
  assert.equal(m.alternates.languages.en, "https://naestvedlokalt.dk/en/x");
  assert.equal(m.robots.index, false);
  assert.ok(m.robots.unavailable_after === undefined, "unavailable_after kun på indekserbare sider");
  assert.deepEqual(m.keywords, ["Byråd", "Skole"]);
  assert.equal(m.other.news_keywords, "Næstved, Skole");
  assert.equal(m.other.standout, "https://andet.dk/o");
  assert.equal(m.openGraph.locale, "en_GB");
  assert.equal(m.openGraph.type, "article");
  assert.ok(String(m.openGraph.expirationTime).startsWith("2027-01-01"));
  assert.equal(m.twitter.card, "summary");

  const indexable = (await buildPageMetadata({ site, path: "/nyheder/x", title: "T", unavailableAfter: new Date("2027-01-01T00:00:00Z") })) as Rec;
  assert.match(indexable.robots.unavailable_after, /^2027-01-01T/);
  assert.match(indexable.robots.googleBot.unavailable_after, /^2027-01-01T/);
  assert.equal(indexable.openGraph.locale, "da_DK", "uændret standard for øvrige sider");
});

const baseArticle = {
  titel: "Næstved Byråd tilfører 14 millioner </script>",
  manchet: "<p>Kort fortalt</p>",
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

test("JSON-LD: headline fra seoTitel||titel (≤110), schemaType, gratis/paywall, wordCount, timeRequired, medforfattere, dateline, expires, kilder", () => {
  const meta = articleMetaSchema.parse({
    schemaType: "ReportageNewsArticle", isAccessibleForFree: false, paywall: { cssSelector: ".betaling" }, dateline: "NÆSTVED —", laesetidMin: 4,
    udloebTid: "2027-01-01T00:00:00Z", begivenhedTid: "2026-09-30T08:00:00Z", keywords: ["byråd"],
    medforfattere: [{ navn: "Pia Foto", rolle: "Fotograf" }, { navn: "Ole Medforf", rolle: "Medforfatter" }, { navn: "Ed Itor", rolle: "Redaktør" }],
    kilder: [{ titel: "Budgetnotat", url: "https://naestved.dk/budget", udgiver: "Næstved Kommune", dato: "2026-09-29" }, { titel: "Intet url" }],
    sistSubstantielOpdateringTid: "2026-10-02T12:00:00Z",
  });
  const node = newsArticleNode({ ...baseArticle, seoTitel: "A".repeat(200), bodyText: "et to tre fire fem seks syv otte ni ti", meta: { ...meta, ogImageUrl: `${base}/uploads/og.jpg`, medforfattere: meta.medforfattere.map((c) => ({ ...c, slug: null })) } }, site, cfg, base) as Rec;
  assert.ok(node.headline.length <= 110);
  assert.ok(node.headline.startsWith("AAAA"), "headline fra seoTitel");
  assert.equal(node["@type"], "ReportageNewsArticle");
  assert.equal(node.isAccessibleForFree, false);
  assert.equal(node.hasPart.cssSelector, ".betaling");
  assert.equal(node.hasPart.isAccessibleForFree, false);
  assert.equal(node.wordCount, 10);
  assert.equal(node.timeRequired, "PT4M");
  assert.equal(node.dateline, "NÆSTVED —");
  assert.match(node.expires, /^2027-01-01/);
  assert.match(node.contentReferenceTime, /^2026-09-30/);
  assert.match(node.dateModified, /^2026-10-02/, "substantiel opdatering går forud for tekniske gem");
  assert.deepEqual(node.keywords, ["byråd"]);
  assert.ok(Array.isArray(node.author) && node.author.length === 2 && node.author[1].name === "Ole Medforf");
  assert.equal(node.editor[0].name, "Ed Itor");
  assert.equal(node.contributor[0].jobTitle, "Fotograf");
  assert.equal(node.citation.length, 2);
  assert.equal(node.citation[0].publisher.name, "Næstved Kommune");
  assert.equal(node.citation[1].url, undefined);
  assert.equal(node.image[0], `${base}/uploads/og.jpg`, "valgt OG-billede er første billede");
  assert.equal(node.speakable, undefined, "speakable kun for engelsk med manchet");
});

test("JSON-LD: uden metadata er output uændret (default NewsArticle, gratis, ingen nye felter); speakable kun for engelsk", () => {
  const node = newsArticleNode(baseArticle, site, cfg, base) as Rec;
  assert.equal(node["@type"], "NewsArticle");
  assert.equal(node.isAccessibleForFree, true);
  assert.equal(node.hasPart, undefined);
  assert.equal(node.wordCount, undefined);
  assert.equal(node.dateline, undefined);
  assert.equal(node.alternativeHeadline, undefined);
  const en = newsArticleNode({ ...baseArticle, sprog: "en" }, site, cfg, base) as Rec;
  assert.equal(en.inLanguage, "en");
  assert.deepEqual(en.speakable.cssSelector, [".site-article-h1", ".site-article-manchet"]);
  const dateline = newsArticleNode({ ...baseArticle, meta: { schemaType: "Article", dateline: "X" } }, site, cfg, base) as Rec;
  assert.equal(dateline.dateline, undefined, "dateline kun på NewsArticle-typer");
});

test("JSON-LD-escaping: </script> og U+2028 i artikel- og metadatafelter bryder ikke ud af script-blokken", () => {
  const meta = articleMetaSchema.parse({ dateline: "</script><script>alert(1)</script>", kilder: [{ titel: "</script>x y" }] });
  const node = newsArticleNode({ ...baseArticle, seoTitel: "</script><img src=x onerror=alert(1)>", meta }, site, cfg, base);
  const out = safeJsonLd({ "@context": "https://schema.org", "@graph": [node] });
  assert.ok(!out.includes("</script"), "ingen rå </script");
  assert.ok(!out.includes("<"), "alle < er escapet");
  assert.ok(!out.includes(" "));
  assert.doesNotThrow(() => JSON.parse(out));
});

test("news-sitemap: news:keywords (højst 10, escapet) kun når de findes", () => {
  const xml = newsSitemapXml("NæstvedLokalt", [
    { loc: "https://x.dk/a", title: "A", publishedAt: new Date("2026-10-01T10:00:00Z"), keywords: ["Byråd", "Skole & fritid"] },
    { loc: "https://x.dk/b", title: "B", publishedAt: new Date("2026-10-01T10:00:00Z") },
  ]);
  assert.match(xml, /<news:keywords>Byråd, Skole &amp; fritid<\/news:keywords>/);
  assert.equal((xml.match(/<news:keywords>/g) ?? []).length, 1);
});

test("delings-previews og SERP-hjælpere bruger samme funktioner som sitet", () => {
  const p = buildPreviews({ ...common, titel: "T".repeat(80), seoBeskrivelse: "B".repeat(200), draft: true });
  assert.ok(p.serp.title.length <= 60);
  assert.equal(p.serp.titleClipped, true);
  assert.equal(p.serp.descriptionClipped, true);
  assert.ok(p.serp.description.length <= 155);
  assert.equal(p.serp.displayUrl, "naestvedlokalt.dk › nyheder › byraad-skole");
  assert.equal(displayUrl("https://www.x.dk/a/b"), "x.dk › a › b");
  assert.equal(p.cards.x.card, "summary_large_image");
  assert.ok(p.cards.facebook.title.length <= 88);
  assert.equal(p.cards.linkedin.description, "");
});

test("SEO-score er deterministisk og vægtet til 100; komplet artikel = 100, tom = lav; ikke-blokerende advarsler", () => {
  const empty = computeSeoScore({ titel: "", slug: "", tagCount: 0, geoCount: 0, wordCount: 0 });
  assert.ok(empty.score < 20);
  assert.equal(empty.complete, false);
  assert.ok(empty.warnings.length > 5);
  assert.equal(empty.items.reduce((n, i) => n + i.weight, 0), 100);

  const good = computeSeoScore({
    titel: "Byrådet vedtager nyt budget for skolerne i Næstved", seoBeskrivelse: "B".repeat(100), manchet: "En manchet der er lang nok til at tælle med.",
    slug: "byraad-skole", kategoriId: "k", forfatterId: "f", cover: { altTekst: "Rådhuset set fra torvet" }, tagCount: 3, geoCount: 1, wordCount: 400,
    meta: articleMetaSchema.parse({ social: { facebook: { tekst: "a", hashtags: [] }, x: { tekst: "b", hashtags: [] }, linkedin: { tekst: "c", hashtags: [] } } }),
    shareImageAvailable: true,
  });
  assert.equal(good.score, 100);
  assert.equal(good.complete, true);
  assert.deepEqual(computeSeoScore({ titel: "x", slug: "x", tagCount: 0, geoCount: 0, wordCount: 0 }), computeSeoScore({ titel: "x", slug: "x", tagCount: 0, geoCount: 0, wordCount: 0 }));
  const noindex = computeSeoScore({ titel: "Byrådet vedtager nyt budget for skolerne i Næstved", slug: "ok-slug", tagCount: 0, geoCount: 0, wordCount: 0, meta: { robotsNoindex: true } });
  assert.equal(noindex.items.find((i) => i.id === "indeks")?.status, "warn");
});

test("formatering: 'Sidst gemt i dag/i går', datetime-local <-> ISO i dansk tid (sommer- og vintertid)", () => {
  const now = new Date("2026-10-02T10:00:00Z");
  assert.equal(formatSavedAt(new Date("2026-10-02T08:24:00Z"), now), "i dag 10:24");
  assert.equal(formatSavedAt(new Date("2026-10-01T20:05:00Z"), now), "i går 22:05");
  assert.match(formatSavedAt(new Date("2026-09-20T08:24:00Z"), now), /20\. sep\.? 10:24/);
  assert.equal(toLocalInput("2026-07-01T05:30:00Z"), "2026-07-01T07:30");
  assert.equal(toLocalInput("2026-12-01T05:30:00Z"), "2026-12-01T06:30");
  assert.equal(fromLocalInput("2026-07-01T07:30"), "2026-07-01T05:30:00.000Z");
  assert.equal(fromLocalInput("2026-12-01T06:30"), "2026-12-01T05:30:00.000Z");
  assert.equal(fromLocalInput(""), "");
  assert.equal(toLocalInput(null), "");
});

test("formtilstand -> FormData -> gem-input: alle felter overlever turen (inkl. metadata, planlagtTid, baseVersion)", () => {
  const meta = serializeMeta(articleMetaSchema.parse({ ogTitel: "OG", keywords: ["a"], social: { x: { tekst: "Hej", hashtags: ["by"] } }, udloebTid: "2027-01-01T00:00:00Z" }));
  const state = initialFormState({
    id: "abc12345", titel: "Titel her", manchet: "Mancet", slug: "titel-her", blocks: [{ id: "b", type: "paragraph", data: { content: "<p>x</p>" } }], status: "Udkast", indholdstype: "Partner",
    aiBrug: ["Udkast"], marking: { sponsor: "Bank", labelTekst: "Finansieret af", aftaleId: "A1" }, pinned: true, breaking: false, seoTitel: "S", seoBeskrivelse: "SB", sprog: "da",
    kategoriId: "k1", forfatterId: "f1", coverMediaId: "m1", tagIds: ["t1", "t2"], geoTagIds: ["g1"], planlagtTid: "2026-10-05T05:30:00.000Z", version: 5, meta, publiceretTid: null,
  });
  const parsed = articleInputFromFormData(toFormData(state, { baseVersion: 5, targetStatus: "Redigering", slugAuto: true }));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  const i = parsed.input;
  assert.equal(i.titel, "Titel her");
  assert.equal(i.slug, "titel-her");
  assert.equal(i.slugAuto, true);
  assert.deepEqual(i.tagIds, ["t1", "t2"]);
  assert.deepEqual(i.aiBrug, ["Udkast"]);
  assert.equal(i.marking.sponsor, "Bank");
  assert.equal(i.marking.aftaleId, "A1");
  assert.equal(i.pinned, true);
  assert.equal(i.planlagtTid?.toISOString(), "2026-10-05T05:30:00.000Z");
  assert.equal(i.meta?.ogTitel, "OG");
  assert.equal(i.meta?.social.x?.hashtags[0], "by");
  assert.ok(i.meta?.udloebTid instanceof Date);
  assert.equal(baseVersionFromFormData(toFormData(state, { baseVersion: 5 })), 5);
  const noPlan = articleInputFromFormData(toFormData({ ...state, planlagtTid: "" }));
  assert.ok(noPlan.ok && noPlan.input.planlagtTid === null, "tom streng rydder");
  const fdMissing = new FormData();
  fdMissing.append("titel", "x");
  const missing = articleInputFromFormData(fdMissing);
  assert.ok(missing.ok && missing.input.planlagtTid === undefined && missing.input.meta === undefined, "manglende felter = uændret");
  const badMeta = new FormData();
  badMeta.append("meta", "{ikke json");
  assert.equal(articleInputFromFormData(badMeta).ok, false);
  void emptyMeta;
});

test("listeparametre: whitelist, sikre værdier og URL-synkronisering", () => {
  const p = parseListParams({ tab: "Kladder", status: "Opfundet", sort: "aeldste", view: "gitter", id: "abcdefgh12", q: "  byråd  ", forfatter: "../x", breaking: "1" });
  assert.equal(p.tab, "Kladder");
  assert.equal(p.status, "", "ukendt status ignoreres");
  assert.equal(p.forfatter, "", "ugyldigt forfatter-id ignoreres");
  assert.equal(p.sort, "asc");
  assert.equal(p.view, "gitter");
  assert.equal(p.q, "byråd");
  assert.equal(parseListParams({ id: "<x>" }).id, "");
  assert.equal(listHref({ ...p, id: "" }, { id: "abcdefgh12" }), "/redaktion/artikler?tab=Kladder&q=byr%C3%A5d&sort=aeldste&view=gitter&breaking=1&id=abcdefgh12");
  assert.equal(listHref({ ...p, tab: "Alle", q: "", sort: "desc", view: "liste", breaking: false }), "/redaktion/artikler");
});

test("brødtekst som ren tekst: ordtælling og læsetid", () => {
  const text = blocksPlainText([
    { id: "1", type: "paragraph", data: { content: "<p>Et <strong>to</strong> tre &amp; fire</p>" } },
    { id: "2", type: "heading", data: { text: "Fem seks", level: 2 } },
    { id: "3", type: "image", data: { url: "/a.jpg", alt: "alt" } },
  ]);
  assert.equal(countWords(text), 7);
  assert.equal(readingMinutes(400), 2);
  assert.equal(readingMinutes(0), 0);
});

test("preview-adgang: login, rettighed, tenant og ret til at redigere artiklen", () => {
  const author = { id: "u1", authorId: "a1", instansId: "i1", permissions: [PERMISSIONS.ARTICLE_CREATE] };
  const own = { forfatterId: "a1", instansId: "i1" };
  assert.deepEqual(articlePreviewDecision(null, own), { allow: false, reason: "login" });
  assert.deepEqual(articlePreviewDecision({ ...author, permissions: [] }, own), { allow: false, reason: "forbidden" });
  assert.deepEqual(articlePreviewDecision(author, null), { allow: false, reason: "missing" });
  assert.deepEqual(articlePreviewDecision(author, { forfatterId: "a1", instansId: "ANDEN" }), { allow: false, reason: "missing" });
  assert.deepEqual(articlePreviewDecision(author, { forfatterId: "a2", instansId: "i1" }), { allow: false, reason: "forbidden" });
  assert.deepEqual(articlePreviewDecision(author, own), { allow: true });
  assert.deepEqual(articlePreviewDecision({ ...author, permissions: [PERMISSIONS.ARTICLE_CREATE, PERMISSIONS.ARTICLE_EDIT_ALL] }, { forfatterId: "a2", instansId: "i1" }), { allow: true });
});
