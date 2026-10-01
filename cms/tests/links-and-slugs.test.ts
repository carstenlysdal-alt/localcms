import assert from "node:assert/strict";
import test from "node:test";
import { slugify, transliterateDa, legacyPathToAscii, searchVariants, isAsciiSlug } from "../lib/slug";
import {
  siteOrigin,
  resolveSwitchPath,
  networkHref,
  isLocalHost,
} from "../lib/network-sites";
import { resolveSiteDomain } from "../lib/site";
import { newsletterSchema } from "../lib/newsletter";

test("slugify translittererer æøå til ae/oe/aa", () => {
  assert.equal(slugify("Døgnrapport: Nattens hændelser i Sydvestsjælland"), "doegnrapport-nattens-haendelser-i-sydvestsjaelland");
  assert.equal(transliterateDa("Åben Ærø Østergade"), "aaben aeroe oestergade");
  assert.equal(isAsciiSlug("doegnrapport-x"), true);
  assert.equal(isAsciiSlug("døgnrapport"), false);
});

test("legacyPathToAscii omdirigerer rå og percent-kodede ø-slugs", () => {
  assert.equal(legacyPathToAscii("/nyheder/døgnrapport-overblik"), "/nyheder/doegnrapport-overblik");
  assert.equal(legacyPathToAscii("/nyheder/d%C3%B8gnrapport-overblik"), "/nyheder/doegnrapport-overblik");
  assert.equal(legacyPathToAscii("/nyheder/doegnrapport-overblik"), null);
  assert.equal(legacyPathToAscii("/%E0%A4%A"), null);
});

test("searchVariants: byraad finder byråd og omvendt", () => {
  assert.ok(searchVariants("byraad").includes("byråd"));
  assert.ok(searchVariants("byråd").includes("byraad"));
  assert.ok(searchVariants("Skælskør").includes("skaelskoer"));
});

test("siteOrigin: rigtige domæner i produktion, *.localhost lokalt", () => {
  assert.equal(siteOrigin("holbaeklokalt.dk", "naestvedlokalt.dk"), "https://holbaeklokalt.dk");
  assert.equal(siteOrigin("holbaeklokalt.dk", "naestvedlokalt.localhost:3000"), "http://holbaeklokalt.localhost:3000");
  assert.equal(siteOrigin("koegelokalt.dk", "localhost:3000"), "http://koegelokalt.localhost:3000");
  assert.equal(isLocalHost("evil.example"), false);
});

test("resolveSwitchPath bevarer kun stier der findes på målbyen", () => {
  const sections = ["/nyheder", "/nyheder/politik", "/kultur"];
  assert.equal(resolveSwitchPath("/nyheder/politik", sections), "/nyheder/politik");
  assert.equal(resolveSwitchPath("/kalender"), "/kalender");
  assert.equal(resolveSwitchPath("/nyheder/en-artikel-slug", sections), "/");
  assert.equal(resolveSwitchPath("/omraade/karrebaeksminde", sections), "/");
  assert.equal(networkHref({ domaene: "x.dk", origin: "https://x.dk" }, "/nyheder/politik", sections), "https://x.dk/nyheder/politik");
});

test("resolveSiteDomain: ukendt vært giver ikke stille Slagelse i produktion", () => {
  const prod = { isProduction: true };
  const r = resolveSiteDomain("evil.example", prod);
  assert.equal(r.allowFallback, false);
  assert.equal(resolveSiteDomain("evil.example", { ...prod, fallbackDomain: "naestvedlokalt.dk" }).allowFallback, true);
  assert.equal(resolveSiteDomain("www.naestvedlokalt.dk", prod).domain, "naestvedlokalt.dk");
  assert.equal(resolveSiteDomain("naestvedlokalt.localhost:3000", prod).domain, "naestvedlokalt.dk");
  // cookie ignoreres i produktion, bruges lokalt på bar localhost
  assert.equal(resolveSiteDomain("localhost:3000", { isProduction: true, devCookie: "holbaeklokalt.dk", defaultDomain: "slagelselokalt.dk" }).domain, "slagelselokalt.dk");
  assert.equal(resolveSiteDomain("localhost:3000", { isProduction: false, devCookie: "holbaeklokalt.dk" }).domain, "holbaeklokalt.dk");
  assert.equal(resolveSiteDomain("localhost:3000", { isProduction: true }).domain, null);
});

test("newsletterSchema: validerer e-mail, samtykke og normaliserer", () => {
  const ok = newsletterSchema.safeParse({ email: "  Test@Eksempel.DK ", samtykke: true });
  assert.ok(ok.success);
  if (ok.success) assert.equal(ok.data.email, "test@eksempel.dk");
  assert.equal(newsletterSchema.safeParse({ email: "ikke-en-mail", samtykke: true }).success, false);
  assert.equal(newsletterSchema.safeParse({ email: "a@b.dk", samtykke: false }).success, false);
  assert.equal(newsletterSchema.safeParse({ email: "a@b.dk", samtykke: true, sektionSlug: "Ø x" }).success, false);
});
