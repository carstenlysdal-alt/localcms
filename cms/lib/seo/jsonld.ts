/**
 * schema.org JSON-LD-byggere. Alle URL'er er absolutte; tomme felter fjernes af
 * safeJsonLd()/pruneEmpty() ved rendering, så der aldrig udsendes "" eller [].
 * Ingen Next/Prisma-importer (testbart med node --test).
 */
import { stripHtml, metaDescription, truncateAtWord } from "./escape";
import { absoluteUrl, articlePath, sectionPath, encodeSegment } from "./url";
import { isoWithOffset } from "./time";
import { isHttpUrl, type SeoSiteConfig } from "./config";
import { inLanguage, NEWS_SCHEMA_TYPES, SCHEMA_TYPES } from "../article-meta";

export type JsonLdNode = Record<string, unknown>;

export type LdSite = {
  domaene: string;
  navn: string;
  kommune: string;
  tagline: string;
};

export type ContentType = "Uafhængig" | "Partner" | "Sponsoreret" | "Brugerindsendt" | "AI-assisteret" | "PR" | string;

export const POLICY_PATHS = {
  principper: "/om-mediet/redaktionelle-principper",
  rettelser: "/om-mediet/rettelser",
  kontakt: "/om-mediet/kontakt",
  omMediet: "/om-mediet",
} as const;

// ── Billeder ────────────────────────────────────────────────────────────────

export type OgFormat = "og" | "16x9" | "4x3" | "1x1";

export const OG_FORMATS: Record<OgFormat, { width: number; height: number }> = {
  og: { width: 1200, height: 630 },
  "16x9": { width: 1200, height: 675 },
  "4x3": { width: 1200, height: 900 },
  "1x1": { width: 1200, height: 1200 },
};

/** Absolut URL til genereret/beskåret raster-billede (JPEG) for en artikel. */
export function articleImageUrl(base: string, slug: string, format: OgFormat = "og", version?: string | number): string {
  const q = new URLSearchParams();
  if (format !== "og") q.set("f", format);
  if (version !== undefined) q.set("v", String(version));
  const qs = q.toString();
  return `${base}/og/artikel/${encodeSegment(slug)}.jpg${qs ? `?${qs}` : ""}`;
}

export function siteImageUrl(base: string, version?: string | number): string {
  return `${base}/og/by.jpg${version !== undefined ? `?v=${version}` : ""}`;
}

// ── Organization / WebSite ──────────────────────────────────────────────────

export function organizationId(base: string): string {
  return `${base}/#organization`;
}

export function organizationNode(site: LdSite, cfg: SeoSiteConfig, base: string): JsonLdNode {
  const alt = `${site.kommune} Lokalt`;
  return {
    "@type": "NewsMediaOrganization",
    "@id": organizationId(base),
    name: site.navn,
    alternateName: alt !== site.navn ? alt : undefined,
    url: `${base}/`,
    logo: cfg.logoUrl
      ? {
          "@type": "ImageObject",
          url: absoluteUrl(base, cfg.logoUrl),
          width: cfg.logoWidth,
          height: cfg.logoHeight,
        }
      : undefined,
    image: siteImageUrl(base),
    slogan: site.tagline,
    description: cfg.description ? truncateAtWord(stripHtml(cfg.description), 300) : site.tagline,
    foundingDate: cfg.foundingDate,
    inLanguage: "da-DK",
    areaServed: { "@type": "AdministrativeArea", name: `${site.kommune} Kommune` },
    address: cfg.address ? { "@type": "PostalAddress", ...cfg.address } : undefined,
    vatID: cfg.vatId,
    telephone: cfg.telephone,
    email: cfg.email,
    contactPoint: cfg.email
      ? [
          {
            "@type": "ContactPoint",
            contactType: "editorial",
            email: cfg.email,
            availableLanguage: "da",
            url: `${base}${POLICY_PATHS.kontakt}`,
          },
        ]
      : undefined,
    sameAs: cfg.sameAs.length > 0 ? cfg.sameAs : undefined,
    publishingPrinciples: `${base}${POLICY_PATHS.principper}`,
    ethicsPolicy: `${base}${POLICY_PATHS.principper}`,
    correctionsPolicy: `${base}${POLICY_PATHS.rettelser}`,
    actionableFeedbackPolicy: `${base}${POLICY_PATHS.kontakt}`,
    masthead: `${base}${POLICY_PATHS.omMediet}`,
    ownershipFundingInfo: cfg.ownershipFundingInfo ? absoluteUrl(base, cfg.ownershipFundingInfo) : undefined,
    diversityPolicy: cfg.diversityPolicy ? absoluteUrl(base, cfg.diversityPolicy) : undefined,
    memberOf: cfg.memberOf ? { "@type": "Organization", name: cfg.memberOf.name, url: cfg.memberOf.url } : undefined,
  };
}

export function websiteNode(site: LdSite, base: string): JsonLdNode {
  const alt = `${site.kommune} Lokalt`;
  return {
    "@type": "WebSite",
    "@id": `${base}/#website`,
    url: `${base}/`,
    name: site.navn,
    alternateName: alt !== site.navn ? alt : undefined,
    inLanguage: "da-DK",
    publisher: { "@id": organizationId(base) },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${base}/soeg?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function siteGraph(site: LdSite, cfg: SeoSiteConfig, base: string): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationNode(site, cfg, base), websiteNode(site, base)],
  };
}

/** Publisher-reference inde i artikler: fuld node så den også virker uden @graph-opslag. */
export function publisherRef(site: LdSite, cfg: SeoSiteConfig, base: string): JsonLdNode {
  return {
    "@type": "NewsMediaOrganization",
    "@id": organizationId(base),
    name: site.navn,
    url: `${base}/`,
    logo: cfg.logoUrl
      ? { "@type": "ImageObject", url: absoluteUrl(base, cfg.logoUrl), width: cfg.logoWidth, height: cfg.logoHeight }
      : undefined,
  };
}

// ── Breadcrumbs ─────────────────────────────────────────────────────────────

export type CrumbInput = { label: string; href?: string };

export function breadcrumbList(items: CrumbInput[], base: string): JsonLdNode | undefined {
  // Mellemled uden href kan ikke repræsenteres (Google kræver item) -> udelades.
  const kept = items.filter((it, i) => it.href || i === items.length - 1);
  if (kept.length === 0) return undefined;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: kept.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: stripHtml(item.label),
      item: item.href ? absoluteUrl(base, item.href) : undefined,
    })),
  };
}

// ── Artikel ─────────────────────────────────────────────────────────────────

/** Udvidet metadata fra ArticleMeta (alle felter valgfrie; udeladte felter giver uændret output). */
export type ArticleLdMeta = {
  schemaType?: string | null;
  isAccessibleForFree?: boolean | null;
  paywall?: { cssSelector: string } | null;
  dateline?: string | null;
  laesetidMin?: number | null;
  udloebTid?: Date | null;
  begivenhedTid?: Date | null;
  keywords?: string[] | null;
  medforfattere?: Array<{ navn: string; rolle: string; authorId?: string | null; slug?: string | null }> | null;
  kilder?: Array<{ titel: string; url?: string | null; udgiver?: string | null; dato?: string | null }> | null;
  sistSubstantielOpdateringTid?: Date | null;
  /** Absolut URL til det billede der er valgt som OG-billede (indgår som første billede). */
  ogImageUrl?: string | null;
};

export type ArticleLdInput = {
  titel: string;
  manchet?: string | null;
  seoTitel?: string | null;
  /** Ren brødtekst (til wordCount/timeRequired); udelades hvis ukendt. */
  bodyText?: string | null;
  meta?: ArticleLdMeta | null;
  seoBeskrivelse?: string | null;
  slug: string;
  indholdstype: ContentType;
  marking?: Record<string, unknown> | null;
  aiBrug?: unknown;
  sprog?: string | null;
  publiceretTid?: Date | null;
  opdateretTid?: Date | null;
  sektion: { navn: string; slug: string };
  undersektion?: { navn: string; slug: string } | null;
  forfatter?: { navn: string; slug?: string | null; bio?: string | null } | null;
  tags?: Array<{ navn: string; slug?: string | null }>;
  geoTags?: Array<{ navn: string; slug?: string | null; lat?: number | null; lng?: number | null }>;
  corrections?: Array<{ tekst: string; dato: Date }>;
  cover?: { altTekst?: string | null; billedtekst?: string | null; ophavsperson?: string | null } | null;
};

const ORG_HINT = /(forening|lag$|klub|råd$|raad$|selskab|kommune|a\/s|aps|fond|skole|kirke|bibliotek|center|union|parti|erhverv|region|politi|beredskab)/i;

/** Gæt Person vs. Organization for fri tekst-afsender (Brugerindsendt/PR). */
export function guessAgentType(name: string): "Person" | "Organization" {
  return ORG_HINT.test(name) ? "Organization" : "Person";
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function articleSchemaType(a: Pick<ArticleLdInput, "indholdstype" | "sektion"> & { meta?: Pick<ArticleLdMeta, "schemaType"> | null }): string {
  const override = a.meta?.schemaType;
  if (override && (SCHEMA_TYPES as readonly string[]).includes(override)) return override;
  switch (a.indholdstype) {
    case "Sponsoreret":
    case "Brugerindsendt":
    case "PR":
      return "Article";
    default:
      return a.sektion.slug === "debat" ? "OpinionNewsArticle" : "NewsArticle";
  }
}

/** Skal artiklen i Google News-sitemap? (spec §7.3) */
export function isNewsSitemapEligible(indholdstype: ContentType): boolean {
  return indholdstype === "Uafhængig" || indholdstype === "AI-assisteret";
}

function personNode(base: string, f: NonNullable<ArticleLdInput["forfatter"]>): JsonLdNode {
  return {
    "@type": "Person",
    ...(f.slug ? { "@id": `${base}/forfatter/${encodeSegment(f.slug)}#person` } : {}),
    name: f.navn,
    url: f.slug ? `${base}/forfatter/${encodeSegment(f.slug)}` : undefined,
  };
}

/** AI-brug udtrukket som liste (tom/"Ingen" -> []). */
function aiUses(aiBrug: unknown): string[] {
  return Array.isArray(aiBrug) ? aiBrug.filter((v): v is string => typeof v === "string" && v.trim() !== "" && v !== "Ingen") : [];
}

/**
 * Ensartet, maskinlæsbar mærkning for ALLE indholdstyper (T6 nr. 5/14): `additionalProperty` med indholdstypen, den
 * synlige mærkning (hvis ikke Uafhængig) og eventuel AI-brug — også for Uafhængig artikler hvor AI er brugt.
 */
function markingProperties(a: ArticleLdInput, labels: { sponsor?: string; afsender?: string; godkendtAf?: string }): JsonLdNode[] {
  const props: JsonLdNode[] = [{ "@type": "PropertyValue", propertyID: "indholdstype", name: "Indholdstype", value: a.indholdstype }];
  const label = str(a.marking?.labelTekst);
  const text =
    a.indholdstype === "Partner" ? `${label ?? "Partnerindhold"}${labels.sponsor ? `: ${labels.sponsor}` : ""}`
    : a.indholdstype === "Sponsoreret" ? `${label ?? "Sponsoreret indhold"}${labels.sponsor ? `: ${labels.sponsor}` : ""}`
    : a.indholdstype === "PR" ? `Pressemeddelelse${labels.afsender ? ` fra ${labels.afsender}` : ""}`
    : a.indholdstype === "Brugerindsendt" ? `Indsendt materiale${labels.afsender ? ` fra ${labels.afsender}` : ""}`
    : a.indholdstype === "AI-assisteret" ? `AI-assisteret${labels.godkendtAf ? `, godkendt af ${labels.godkendtAf}` : ""}`
    : undefined;
  if (text) props.push({ "@type": "PropertyValue", propertyID: "maerkning", name: "Mærkning", value: text });
  const uses = aiUses(a.aiBrug);
  if (uses.length > 0) props.push({ "@type": "PropertyValue", propertyID: "ai-brug", name: "AI-brug", value: uses.join(", ") });
  return props;
}

export function newsArticleNode(
  a: ArticleLdInput,
  site: LdSite,
  cfg: SeoSiteConfig,
  base: string,
): JsonLdNode {
  const path = articlePath(a.sektion.slug, a.slug);
  const url = `${base}${path}`;
  const marking = a.marking ?? {};
  const sponsor = str(marking.sponsor);
  const afsender = str(marking.afsender);
  const godkendtAf = str(marking.godkendtAf);
  const kilder = Array.isArray(marking.kilder) ? (marking.kilder as unknown[]).map(str).filter(Boolean) as string[] : [];
  const kildeUrls = kilder.filter(isHttpUrl);
  const kildeTekster = kilder.filter((k) => !isHttpUrl(k));

  const byline = a.forfatter ? personNode(base, a.forfatter) : undefined;
  const orgAuthor: JsonLdNode = { "@type": "Organization", name: site.navn, url: `${base}/` };

  let author: JsonLdNode | undefined = byline;
  const extra: JsonLdNode = {};

  switch (a.indholdstype) {
    case "Partner":
      if (sponsor) extra.sponsor = { "@type": "Organization", name: sponsor };
      extra.backstory = `Partnerindhold${sponsor ? ` finansieret af ${sponsor}` : ""}. Indholdet er tydeligt mærket som partnerindhold.`;
      author = byline ?? orgAuthor;
      break;
    case "Sponsoreret":
      if (sponsor) {
        extra.sponsor = { "@type": "Organization", name: sponsor };
      }
      extra.backstory = `Sponsoreret indhold${sponsor ? ` fra ${sponsor}` : ""}.`;
      author = byline ?? (sponsor ? { "@type": "Organization", name: sponsor } : orgAuthor);
      break;
    case "Brugerindsendt":
      if (afsender) author = { "@type": guessAgentType(afsender), name: afsender };
      else author = byline ?? orgAuthor;
      extra.contributor = { "@type": "Organization", name: site.navn, url: `${base}/` };
      extra.backstory = `Indsendt materiale${afsender ? ` fra ${afsender}` : ""}, redigeret af redaktionen.`;
      break;
    case "PR":
      if (afsender) {
        author = { "@type": "Organization", name: afsender };
        extra.provider = { "@type": "Organization", name: afsender };
      } else author = byline ?? orgAuthor;
      extra.backstory = `Pressemeddelelse${afsender ? ` fra ${afsender}` : ""}.`;
      break;
    case "AI-assisteret": {
      const godkender = godkendtAf ? { "@type": "Person", name: godkendtAf } : undefined;
      author = byline ?? godkender ?? orgAuthor;
      if (godkender) extra.editor = godkender;
      if (kildeUrls.length > 0) extra.isBasedOn = kildeUrls;
      if (kildeTekster.length > 0) extra.citation = kildeTekster;
      extra.backstory = `Udarbejdet med AI-assistance${godkendtAf ? ` og godkendt af ${godkendtAf}` : " og gennemset af redaktionen"}.`;
      break;
    }
    default:
      author = byline ?? orgAuthor;
      // Uafhængig med AI-brug (fx sproglig korrektur): oplys det maskinlæsbart og i klartekst.
      if (aiUses(a.aiBrug).length > 0) extra.backstory = `Redaktionelt indhold med AI-støtte (${aiUses(a.aiBrug).join(", ").toLowerCase()}), gennemset af redaktionen.`;
  }
  extra.additionalProperty = markingProperties(a, { sponsor, afsender, godkendtAf });

  const description = metaDescription(a.seoBeskrivelse || a.manchet);
  const published = isoWithOffset(a.publiceretTid ?? a.opdateretTid ?? null);
  // "Sidst substantielt opdateret" (redaktørens valg) går forud for tekniske gem (opdateretTid ændres også af små rettelser).
  const modified = isoWithOffset(a.meta?.sistSubstantielOpdateringTid ?? a.opdateretTid ?? a.publiceretTid ?? null);
  const version = a.opdateretTid ? a.opdateretTid.getTime() : undefined;

  const allImages = (["16x9", "4x3", "1x1"] as OgFormat[]).map((f) => articleImageUrl(base, a.slug, f, version));
  const ogImg = a.meta?.ogImageUrl && isHttpUrl(a.meta.ogImageUrl) ? a.meta.ogImageUrl : undefined;
  const keywords = [...(a.tags ?? []).map((t) => t.navn), ...(a.geoTags ?? []).map((g) => g.navn)];
  const primaryGeo = a.geoTags?.[0];

  // ── Udvidet metadata (ArticleMeta) ──
  const m = a.meta ?? {};
  const schemaType = articleSchemaType(a);
  const explicitKeywords = (m.keywords ?? []).filter((k) => typeof k === "string" && k.trim());
  const credits = m.medforfattere ?? [];
  const personOf = (c: { navn: string; slug?: string | null }): JsonLdNode => ({ "@type": "Person", name: c.navn, url: c.slug ? `${base}/forfatter/${encodeSegment(c.slug)}` : undefined });
  const coAuthors = credits.filter((c) => c.rolle === "Medforfatter").map(personOf);
  const editors = credits.filter((c) => c.rolle === "Redaktør").map(personOf);
  const contributors = credits
    .filter((c) => c.rolle !== "Medforfatter" && c.rolle !== "Redaktør")
    .map((c) => ({ ...personOf(c), jobTitle: c.rolle }));
  const allAuthors = coAuthors.length > 0 ? [author, ...coAuthors].filter((x): x is JsonLdNode => Boolean(x)) : undefined;
  const words = a.bodyText ? a.bodyText.trim().split(/\s+/).filter(Boolean).length : 0;
  const minutes = m.laesetidMin ?? (words > 0 ? Math.max(1, Math.round(words / 200)) : undefined);
  const sources = (m.kilder ?? []).filter((k) => k.titel.trim()).map((k) => ({
    "@type": "CreativeWork",
    name: k.titel,
    url: k.url && isHttpUrl(k.url) ? k.url : undefined,
    publisher: k.udgiver ? { "@type": "Organization", name: k.udgiver } : undefined,
    datePublished: k.dato || undefined,
  }));
  const existingCitation = extra.citation as unknown[] | undefined;
  const citation = [...(existingCitation ?? []), ...sources];
  const lang = inLanguage(a.sprog);
  // Speakable kun med rigtigt grundlag: Google understøtter det alene for engelsk, og vælgerne skal findes i markup.
  const speakable = lang.startsWith("en") && a.manchet?.trim()
    ? { "@type": "SpeakableSpecification", cssSelector: [".site-article-h1", ".site-article-manchet"] }
    : undefined;
  const asList = (v: unknown): JsonLdNode[] => (Array.isArray(v) ? (v as JsonLdNode[]) : v ? [v as JsonLdNode] : []);
  const mergedContributors = [...asList(extra.contributor), ...contributors];
  const mergedEditors = [...asList(extra.editor), ...editors];
  const freeAccess = m.isAccessibleForFree !== false;
  const images = ogImg ? [ogImg, ...allImages] : allImages;

  return {
    "@type": schemaType,
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    headline: truncateAtWord(stripHtml(a.seoTitel?.trim() || a.titel), 110),
    alternativeHeadline: a.seoTitel?.trim() && stripHtml(a.seoTitel) !== stripHtml(a.titel) ? truncateAtWord(stripHtml(a.titel), 110) : undefined,
    description,
    image: images,
    datePublished: published,
    dateModified: modified,
    inLanguage: lang,
    isAccessibleForFree: freeAccess,
    hasPart: !freeAccess
      ? { "@type": "WebPageElement", isAccessibleForFree: false, cssSelector: m.paywall?.cssSelector || ".site-article-blocks" }
      : undefined,
    articleSection: a.sektion.navn,
    keywords: explicitKeywords.length > 0 ? explicitKeywords : keywords.length > 0 ? keywords : undefined,
    about: (a.tags ?? []).map((t) => ({ "@type": "Thing", name: t.navn })),
    wordCount: words > 0 ? words : undefined,
    timeRequired: minutes ? `PT${minutes}M` : undefined,
    dateline: NEWS_SCHEMA_TYPES.includes(schemaType) && m.dateline?.trim() ? m.dateline.trim() : undefined,
    expires: isoWithOffset(m.udloebTid ?? null),
    contentReferenceTime: isoWithOffset(m.begivenhedTid ?? null),
    speakable,
    author: allAuthors ?? author,
    publisher: publisherRef(site, cfg, base),
    ...extra,
    ...(citation.length > 0 ? { citation } : {}),
    ...(contributors.length > 0 ? { contributor: mergedContributors } : {}),
    ...(editors.length > 0 ? { editor: mergedEditors } : {}),
    contentLocation: primaryGeo
      ? {
          "@type": "Place",
          name: primaryGeo.navn,
          geo:
            typeof primaryGeo.lat === "number" && typeof primaryGeo.lng === "number"
              ? { "@type": "GeoCoordinates", latitude: primaryGeo.lat, longitude: primaryGeo.lng }
              : undefined,
        }
      : undefined,
    publishingPrinciples: `${base}${POLICY_PATHS.principper}`,
    correction:
      a.corrections && a.corrections.length > 0
        ? a.corrections.map((c) => ({
            "@type": "CorrectionComment",
            text: stripHtml(c.tekst),
            datePublished: isoWithOffset(c.dato),
            url: `${base}${POLICY_PATHS.rettelser}`,
          }))
        : undefined,
    creditText: a.cover?.ophavsperson ? creditLabel(a.cover.ophavsperson) : undefined,
  };
}

/** `Foto: X` – men bevar kreditter der allerede er et mærke (Arkivfoto, Foto, Illustration, Ritzau …). */
export function creditLabel(ophavsperson: string): string {
  const t = ophavsperson.trim();
  return /^(arkiv)?foto\b|^illustration\b|^ritzau\b|^grafik\b|^foto:/i.test(t) ? t : `Foto: ${t}`;
}

export function articleGraph(
  a: ArticleLdInput,
  site: LdSite,
  cfg: SeoSiteConfig,
  base: string,
): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": [newsArticleNode(a, site, cfg, base)] };
}

// ── Lister, områder, forfattere ─────────────────────────────────────────────

export type ListItemInput = { href: string };

export function itemList(items: ListItemInput[], base: string, max = 15): JsonLdNode {
  const kept = items.slice(0, max);
  return {
    "@type": "ItemList",
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    numberOfItems: kept.length,
    itemListElement: kept.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absoluteUrl(base, it.href),
    })),
  };
}

export function collectionPage(
  args: {
    path: string;
    name: string;
    description?: string;
    items: ListItemInput[];
    about?: JsonLdNode;
  },
  base: string,
): JsonLdNode {
  const url = absoluteUrl(base, args.path);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#page`,
    url,
    name: args.name,
    description: args.description,
    inLanguage: "da-DK",
    isPartOf: { "@id": `${base}/#website` },
    publisher: { "@id": organizationId(base) },
    about: args.about,
    mainEntity: args.items.length > 0 ? itemList(args.items, base) : undefined,
  };
}

export function sectionCollection(
  args: { sektion: { navn: string; slug: string }; undersektion?: { navn: string; slug: string } | null; name: string; description?: string; items: ListItemInput[] },
  base: string,
): JsonLdNode {
  return collectionPage(
    {
      path: sectionPath(args.sektion.slug, args.undersektion?.slug),
      name: args.name,
      description: args.description,
      items: args.items,
    },
    base,
  );
}

export function areaCollection(
  args: { slug: string; navn: string; lat?: number | null; lng?: number | null; kommune: string; description?: string; items: ListItemInput[] },
  base: string,
): JsonLdNode {
  return collectionPage(
    {
      path: `/omraade/${encodeSegment(args.slug)}`,
      name: `Nyheder fra ${args.navn}`,
      description: args.description,
      items: args.items,
      about: {
        "@type": "Place",
        name: args.navn,
        geo:
          typeof args.lat === "number" && typeof args.lng === "number"
            ? { "@type": "GeoCoordinates", latitude: args.lat, longitude: args.lng }
            : undefined,
        containedInPlace: { "@type": "AdministrativeArea", name: `${args.kommune} Kommune` },
      },
    },
    base,
  );
}

export function topicCollection(
  args: { slug: string; navn: string; description?: string; items: ListItemInput[] },
  base: string,
): JsonLdNode {
  return collectionPage(
    {
      path: `/emne/${encodeSegment(args.slug)}`,
      name: args.navn,
      description: args.description,
      items: args.items,
      about: { "@type": "Thing", name: args.navn },
    },
    base,
  );
}

export function profilePage(
  args: {
    slug: string;
    navn: string;
    bio?: string | null;
    kontakt?: string | null;
    profilbilledeUrl?: string | null;
    forfatterType?: string | null;
    dateModified?: Date | null;
  },
  base: string,
): JsonLdNode {
  const url = `${base}/forfatter/${encodeSegment(args.slug)}`;
  const bio = args.bio ? truncateAtWord(stripHtml(args.bio), 300) : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${url}#page`,
    url,
    inLanguage: "da-DK",
    dateModified: isoWithOffset(args.dateModified ?? null),
    mainEntity: {
      "@type": "Person",
      "@id": `${url}#person`,
      name: args.navn,
      url,
      description: bio,
      image: args.profilbilledeUrl && !/\.svg(\?|$)/i.test(args.profilbilledeUrl) ? absoluteUrl(base, args.profilbilledeUrl) : undefined,
      worksFor: { "@id": organizationId(base) },
    },
  };
}

// ── Event (kun når rigtige events findes i databasen) ───────────────────────

export type EventInput = {
  slug: string;
  navn: string;
  start: Date;
  slut?: Date | null;
  beskrivelse?: string | null;
  sted?: { navn: string; adresse?: string | null; postnummer?: string | null; by?: string | null } | null;
  arrangoer?: { navn: string; url?: string | null } | null;
  billedeUrl?: string | null;
  gratis?: boolean;
  pris?: number | null;
  status?: "EventScheduled" | "EventCancelled" | "EventPostponed";
};

export function eventNode(e: EventInput, base: string): JsonLdNode {
  const url = `${base}/kalender/${encodeSegment(e.slug)}`;
  const price = e.gratis ? 0 : e.pris ?? undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    "@id": `${url}#event`,
    name: e.navn,
    url,
    startDate: isoWithOffset(e.start),
    endDate: isoWithOffset(e.slut ?? null),
    eventStatus: `https://schema.org/${e.status ?? "EventScheduled"}`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    description: e.beskrivelse ? metaDescription(e.beskrivelse, "", 300) : undefined,
    location: e.sted
      ? {
          "@type": "Place",
          name: e.sted.navn,
          address: {
            "@type": "PostalAddress",
            streetAddress: e.sted.adresse ?? undefined,
            postalCode: e.sted.postnummer ?? undefined,
            addressLocality: e.sted.by ?? undefined,
            addressCountry: "DK",
          },
        }
      : undefined,
    organizer: e.arrangoer
      ? { "@type": "Organization", name: e.arrangoer.navn, url: e.arrangoer.url ?? undefined }
      : undefined,
    image: e.billedeUrl ? [absoluteUrl(base, e.billedeUrl)] : undefined,
    offers:
      price !== undefined
        ? {
            "@type": "Offer",
            price: String(price),
            priceCurrency: "DKK",
            availability: "https://schema.org/InStock",
            url,
          }
        : undefined,
  };
}

// ── Priser ──────────────────────────────────────────────────────────────────

export type OfferInput = {
  name: string;
  price: number;
  description?: string;
  /** Månedlig pris (UnitPriceSpecification, unitText MON). */
  perMonth?: boolean;
  service?: string;
};

export function offerCatalog(
  args: { name: string; offers: OfferInput[] },
  site: LdSite,
  base: string,
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "@id": `${base}/priser#catalog`,
    name: args.name,
    url: `${base}/priser`,
    provider: { "@id": organizationId(base) },
    itemListElement: args.offers.map((o) => ({
      "@type": "Offer",
      name: o.name,
      description: o.description,
      price: String(o.price),
      priceCurrency: "DKK",
      priceSpecification: o.perMonth
        ? {
            "@type": "UnitPriceSpecification",
            price: String(o.price),
            priceCurrency: "DKK",
            unitText: "MON",
            valueAddedTaxIncluded: false,
          }
        : { "@type": "PriceSpecification", price: String(o.price), priceCurrency: "DKK", valueAddedTaxIncluded: false },
      itemOffered: { "@type": "Service", name: o.service ?? o.name, provider: { "@id": organizationId(base) } },
    })),
  };
}

/** Statiske sider: AboutPage / ContactPage / WebPage. */
export function webPageNode(
  args: { type?: "WebPage" | "AboutPage" | "ContactPage"; path: string; name: string; description?: string },
  base: string,
): JsonLdNode {
  const url = absoluteUrl(base, args.path);
  return {
    "@context": "https://schema.org",
    "@type": args.type ?? "WebPage",
    "@id": `${url}#page`,
    url,
    name: args.name,
    description: args.description,
    inLanguage: "da-DK",
    isPartOf: { "@id": `${base}/#website` },
    about: args.type === "AboutPage" ? { "@id": organizationId(base) } : undefined,
    publisher: { "@id": organizationId(base) },
  };
}
