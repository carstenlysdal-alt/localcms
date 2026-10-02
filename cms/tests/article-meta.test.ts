import assert from "node:assert/strict";
import test from "node:test";
import {
  articleMetaSchema, buildShareLink, checkPost, composePost, defaultUtm, emptyMeta, inLanguage, isDefaultMeta, mergeMetaPatchForTest, metaFromRow, normalizeHashtag, ogLocale, parseMetaField,
  PLATFORM_SPECS, postLength, serializeMeta, SOCIAL_PLATFORMS,
} from "./helpers/meta-exports";

test("platformsgrænser: X 280 (link = 23), Bluesky 300, Instagram 2200, LinkedIn 3000", () => {
  assert.equal(PLATFORM_SPECS.x.max, 280);
  assert.equal(PLATFORM_SPECS.bluesky.max, 300);
  assert.equal(PLATFORM_SPECS.instagram.max, 2200);
  assert.equal(PLATFORM_SPECS.linkedin.max, 3000);
  assert.deepEqual([...SOCIAL_PLATFORMS], ["facebook", "instagram", "linkedin", "x", "bluesky"]);

  // X: et langt link tæller kun 23 tegn
  const long = "https://example.dk/" + "a".repeat(200);
  assert.equal(postLength("x", { tekst: "Hej", hashtags: [], link: long }), 3 + 2 + 23);
  // Instagram: link tælles ikke (ikke klikbart i billedtekst)
  assert.equal(postLength("instagram", { tekst: "Hej", hashtags: [], link: long }), 3);
  // hashtags indgår
  assert.equal(postLength("bluesky", { tekst: "Hej", hashtags: ["by", "nyt"] }), 3 + 2 + "#by #nyt".length);
});

test("checkPost: hård fejl over grænsen, blød advarsel over anbefalet, hashtag-loft", () => {
  const tooLongX = checkPost("x", { tekst: "x".repeat(270), hashtags: [], link: "https://a.dk" });
  assert.ok(tooLongX.errors.length === 1, "270 + 2 + 23 > 280");
  const ok = checkPost("x", { tekst: "x".repeat(200), hashtags: [], link: "https://a.dk" });
  assert.deepEqual(ok.errors, []);
  const soft = checkPost("facebook", { tekst: "x".repeat(600), hashtags: [] });
  assert.deepEqual(soft.errors, []);
  assert.equal(soft.warnings.length, 1);
  const tags = checkPost("linkedin", { tekst: "ok", hashtags: ["a", "b", "c", "d", "e", "f"] });
  assert.match(tags.errors[0], /hashtags/);
});

test("hashtags normaliseres (ingen #, ingen mellemrum, ingen dubletter); ugyldige tegn afvises", () => {
  assert.equal(normalizeHashtag("  ##By råd "), "Byråd");
  const parsed = articleMetaSchema.parse({ social: { x: { tekst: "Hej", hashtags: ["#Byråd", "byråd", "ny nyhed", "!!", ""] } } });
  assert.deepEqual(parsed.social.x?.hashtags, ["Byråd", "nynyhed"]);
});

test("metadata-skema: tegngrænser pr. platform validerer hele objektet", () => {
  const bad = articleMetaSchema.safeParse({ social: { x: { tekst: "x".repeat(300), hashtags: [] } } });
  assert.equal(bad.success, false);
  const good = articleMetaSchema.safeParse({ social: { instagram: { tekst: "x".repeat(2000), hashtags: [] } } });
  assert.equal(good.success, true);
});

test("metadata-skema: standardværdier, URL-krav, nøgleord, datoer og schema-type", () => {
  const d = emptyMeta();
  assert.equal(d.robotsNoindex, false);
  assert.equal(d.isAccessibleForFree, true);
  assert.deepEqual(d.keywords, []);
  assert.equal(d.canonicalUrl, null);
  assert.equal(isDefaultMeta(d), true);

  assert.equal(articleMetaSchema.safeParse({ canonicalUrl: "javascript:alert(1)" }).success, false);
  assert.equal(articleMetaSchema.safeParse({ canonicalUrl: "https://andet.dk/a" }).success, true);
  assert.equal(articleMetaSchema.safeParse({ schemaType: "Opfundet" }).success, false);
  assert.equal(articleMetaSchema.safeParse({ twitterCard: "player" }).success, false);
  assert.equal(articleMetaSchema.safeParse({ newsKeywords: Array.from({ length: 11 }, (_, i) => `k${i}`) }).success, false, "højst 10 news_keywords");
  const kw = articleMetaSchema.parse({ keywords: ["Byråd", "byråd", " Skole "] });
  assert.deepEqual(kw.keywords, ["Byråd", "Skole"]);
  const dt = articleMetaSchema.parse({ udloebTid: "2026-12-24T10:00:00Z", begivenhedTid: "" });
  assert.ok(dt.udloebTid instanceof Date);
  assert.equal(dt.begivenhedTid, null);
  assert.equal(articleMetaSchema.safeParse({ udloebTid: "ikke-en-dato" }).success, false);
  assert.equal(articleMetaSchema.safeParse({ kilder: [{ titel: "X", url: "ftp://x" }] }).success, false);
  assert.equal(articleMetaSchema.safeParse({ paywall: { cssSelector: "<script>" } }).success, false);
  assert.equal(articleMetaSchema.safeParse({ oversaettelser: { en: { url: "https://x.dk/en" } } }).success, true);
  assert.equal(articleMetaSchema.safeParse({ oversaettelser: { "Dansk!": { url: "https://x.dk" } } }).success, false);
});

test("parseMetaField: tom = uændret, ugyldig JSON/felt = dansk fejl", () => {
  assert.deepEqual(parseMetaField(null), { ok: true, value: undefined });
  assert.deepEqual(parseMetaField(""), { ok: true, value: undefined });
  const bad = parseMetaField("{nej");
  assert.equal(bad.ok, false);
  const bad2 = parseMetaField(JSON.stringify({ canonicalUrl: "x" }));
  assert.equal(bad2.ok, false);
  const ok = parseMetaField(JSON.stringify({ keywords: ["a"] }));
  assert.ok(ok.ok && ok.value?.keywords[0] === "a");
});

test("metaFromRow er tolerant: ét ødelagt Json-felt skjuler ikke resten; serializeMeta er JSON-sikker", () => {
  const m = metaFromRow({ keywords: "ikke en liste", ogTitel: "Fin titel", social: { x: { tekst: "x".repeat(999), hashtags: [] } }, udloebTid: new Date("2026-12-24T10:00:00Z") });
  assert.equal(m.ogTitel, "Fin titel");
  assert.deepEqual(m.keywords, []);
  assert.deepEqual(m.social, {});
  const s = serializeMeta(m);
  assert.equal(typeof s.udloebTid, "string");
  assert.doesNotThrow(() => JSON.stringify(s));
  assert.equal(metaFromRow(null).canonicalUrl, null);
});

test("mergeMeta flette-semantik: delvist patch bevarer øvrige felter og platforme", () => {
  const base = articleMetaSchema.parse({ ogTitel: "A", social: { x: { tekst: "X-tekst", hashtags: [] } } });
  const merged = mergeMetaPatchForTest(base, { social: { facebook: { tekst: "FB", hashtags: [] } } });
  assert.ok(merged.ok);
  if (merged.ok) {
    assert.equal(merged.value.ogTitel, "A");
    assert.equal(merged.value.social.x?.tekst, "X-tekst");
    assert.equal(merged.value.social.facebook?.tekst, "FB");
  }
  const bad = mergeMetaPatchForTest(base, { social: { x: { tekst: "x".repeat(400), hashtags: [] } } });
  assert.equal(bad.ok, false);
});

test("UTM og delings-link; composePost; locale", () => {
  const utm = defaultUtm("facebook", "byraad-skole");
  assert.deepEqual(utm, { source: "facebook", medium: "social", campaign: "byraad-skole" });
  assert.equal(buildShareLink("https://a.dk/nyheder/x", utm), "https://a.dk/nyheder/x?utm_source=facebook&utm_medium=social&utm_campaign=byraad-skole");
  assert.equal(buildShareLink("https://a.dk/x?y=1", undefined), "https://a.dk/x?y=1");
  assert.equal(composePost("x", { tekst: "Hej", hashtags: ["by"] }, "https://a.dk"), "Hej\n\n#by\n\nhttps://a.dk");
  assert.equal(composePost("instagram", { tekst: "Hej", hashtags: [] }, "https://a.dk"), "Hej", "link udelades på Instagram");
  assert.equal(ogLocale("da"), "da_DK");
  assert.equal(ogLocale("en"), "en_GB");
  assert.equal(ogLocale("en-us"), "en_US");
  assert.equal(ogLocale(undefined), "da_DK");
  assert.equal(inLanguage("da"), "da-DK");
  assert.equal(inLanguage("en"), "en");
});
