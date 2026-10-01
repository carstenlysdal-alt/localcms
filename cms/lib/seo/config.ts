/**
 * Valgfri SEO-/entitetskonfiguration pr. by.
 *
 * Intet opfindes: felter udelades helt når de ikke er konfigureret.
 * Kilder (højeste prioritet først):
 *   1. env `SEO_SITE_CONFIG` – JSON keyed på domæne:
 *        {"naestvedlokalt.dk":{"sameAs":["https://www.facebook.com/…"],"twitterSite":"@…",
 *          "logoUrl":"https://…/logo-512.png","logoWidth":512,"logoHeight":512,
 *          "address":{"streetAddress":"…","postalCode":"4700","addressLocality":"Næstved"},
 *          "vatId":"DK12345678","telephone":"+45…","email":"redaktion@…","foundingDate":"2026",
 *          "memberOf":{"name":"Pressenævnet","url":"https://www.pressenaevnet.dk/"},
 *          "ownershipFundingInfo":"/om-mediet#finansiering",
 *          "fbAppId":"…","googleVerification":"…","fbDomainVerification":"…"}}
 *   2. `Instance.sideTekster.seo` (samme felter) – redigerbart pr. instans i databasen
 *   3. `Instance.logoUrl` (logo)
 *   4. globale env: SEO_TWITTER_SITE, FB_APP_ID, GSC_TOKEN, FB_DOMAIN_TOKEN
 */

export type SeoSiteInput = {
  domaene: string;
  navn: string;
  kommune: string;
  tagline: string;
  logoUrl?: string | null;
  sideTekster?: unknown;
};

export type SeoSiteConfig = {
  sameAs: string[];
  logoUrl?: string;
  logoWidth?: number;
  logoHeight?: number;
  twitterSite?: string;
  fbAppId?: string;
  googleVerification?: string;
  fbDomainVerification?: string;
  address?: {
    streetAddress?: string;
    postalCode?: string;
    addressLocality?: string;
    addressCountry?: string;
  };
  vatId?: string;
  telephone?: string;
  email?: string;
  foundingDate?: string;
  memberOf?: { name: string; url: string };
  /** Sti/URL til side der dokumenterer ejerskab/finansiering. Udelades hvis ikke konfigureret. */
  ownershipFundingInfo?: string;
  diversityPolicy?: string;
  /** Kort beskrivelse til Organization (ellers sideTekster.omMediet / tagline). */
  description?: string;
};

type Json = Record<string, unknown>;

function asObject(v: unknown): Json {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

export function isHttpUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function parseEnvConfig(env: NodeJS.ProcessEnv, domain: string): Json {
  const raw = env.SEO_SITE_CONFIG;
  if (!raw) return {};
  try {
    return asObject(asObject(JSON.parse(raw))[domain]);
  } catch {
    return {};
  }
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export function resolveSeoConfig(site: SeoSiteInput, env: NodeJS.ProcessEnv = process.env): SeoSiteConfig {
  const sideTekster = asObject(site.sideTekster);
  const fromDb = asObject(sideTekster.seo);
  const fromEnv = parseEnvConfig(env, site.domaene);
  const pick = (key: string): unknown => fromEnv[key] ?? fromDb[key];

  const sameAsRaw = pick("sameAs");
  const sameAs = (Array.isArray(sameAsRaw) ? sameAsRaw : typeof sameAsRaw === "string" ? [sameAsRaw] : [])
    .filter(isHttpUrl);

  const addrRaw = asObject(pick("address"));
  const address = {
    streetAddress: str(addrRaw.streetAddress),
    postalCode: str(addrRaw.postalCode),
    addressLocality: str(addrRaw.addressLocality),
    addressCountry: str(addrRaw.addressCountry) ?? "DK",
  };
  const hasAddress = Boolean(address.streetAddress || address.postalCode || address.addressLocality);

  const memberRaw = asObject(pick("memberOf"));
  const memberOf = str(memberRaw.name) && isHttpUrl(memberRaw.url)
    ? { name: str(memberRaw.name)!, url: memberRaw.url as string }
    : undefined;

  const kontaktTekst = str(sideTekster.kontakt);
  const emailFromContent = kontaktTekst?.match(EMAIL_RE)?.[0];

  const twitter = str(pick("twitterSite")) ?? str(env.SEO_TWITTER_SITE);

  return {
    sameAs,
    logoUrl: str(pick("logoUrl")) ?? str(site.logoUrl),
    logoWidth: num(pick("logoWidth")),
    logoHeight: num(pick("logoHeight")),
    twitterSite: twitter ? (twitter.startsWith("@") ? twitter : `@${twitter}`) : undefined,
    fbAppId: str(pick("fbAppId")) ?? str(env.FB_APP_ID),
    googleVerification: str(pick("googleVerification")) ?? str(env.GSC_TOKEN),
    fbDomainVerification: str(pick("fbDomainVerification")) ?? str(env.FB_DOMAIN_TOKEN),
    address: hasAddress ? address : undefined,
    vatId: str(pick("vatId")),
    telephone: str(pick("telephone")),
    email: str(pick("email")) ?? emailFromContent,
    foundingDate: str(pick("foundingDate")),
    memberOf,
    ownershipFundingInfo: str(pick("ownershipFundingInfo")),
    diversityPolicy: str(pick("diversityPolicy")),
    description: str(pick("description")) ?? str(sideTekster.omMediet),
  };
}
