import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import {
  getSectionData,
  getArticleBySlug,
  getSiteNavigation,
  formatDateDivider,
  formatFullDate,
} from "@/lib/site-queries";
import { SectionHeader } from "@/components/site/SectionHeader";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { MarkingBox } from "@/components/site/MarkingBox";
import { Byline } from "@/components/site/Byline";
import { ArticleCard } from "@/components/site/ArticleCard";
import { DateDivider } from "@/components/site/DateDivider";
import { LoadMore } from "@/components/site/LoadMore";
import { NewsletterSignup } from "@/components/site/NewsletterSignup";
import { ArticleEndCta } from "@/components/site/ArticleEndCta";
import { SiteBlockRenderer, normalizeHtml } from "@/components/site/blocks/SiteBlockRenderer";
import { parseBlocks } from "@/lib/blocks/schema";
import { db } from "@/lib/db";
import { BookmarkButton } from "@/components/site/BookmarkButton";
import { AlertCircle, ChevronLeft } from "lucide-react";
import { MetricTracker } from "@/components/site/MetricTracker";
import { JsonLd } from "@/components/site/JsonLd";
import { ShareButton } from "@/components/site/ShareButton";
import { buildPageMetadata, analyzeQuery } from "@/lib/seo/meta";
import { resolveSeoConfig } from "@/lib/seo/config";
import { articleGraph, articleImageUrl, creditLabel, sectionCollection } from "@/lib/seo/jsonld";
import { absoluteUrl, encodeSegment, articlePath, siteBase } from "@/lib/seo/url";
import { stripHtml } from "@/lib/seo/escape";
import { resolveArticleSeo } from "@/lib/seo/article-seo";
import { findArticleRedirect } from "@/lib/slug-redirect";
import { blocksPlainText } from "@/lib/blocks/text";

// Dedupér DB-opslag mellem generateMetadata og selve siden (samme request).
const loadSection = cache(async (instansId: string, sektion: string) =>
  db.category.findFirst({
    where: { instansId, slug: sektion, parentId: null },
    include: { children: { orderBy: { sortering: "asc" } } },
  }),
);
const loadArticle = cache(getArticleBySlug);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ sektion: string; slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { sektion, slug } = await params;
  const query = searchParams ? await searchParams : {};
  const site = await getCurrentSite();
  const base = siteBase(site);

  // Tjek først om det er en undersektion
  const section = await loadSection(site.id, sektion);
  const sub = section?.children.find((c) => c.slug === slug);

  if (section && sub) {
    const { page, hasFilter } = analyzeQuery(query);
    const where = { instansId: site.id, status: "Publiceret", kategoriId: sub.id };
    const [count, top] = await Promise.all([
      db.article.count({ where }),
      db.article.findMany({ where, orderBy: { publiceretTid: "desc" }, take: 3, select: { titel: true } }),
    ]);
    const headlines = top.map((t) => stripHtml(t.titel)).join(" · ");
    return buildPageMetadata({
      site,
      path: `/${encodeSegment(section.slug)}/${encodeSegment(sub.slug)}`,
      title: `${sub.navn} i ${site.kommune} – ${section.navn}`,
      description:
        sub.beskrivelse ||
        `Seneste ${sub.navn.toLowerCase()}-historier fra ${site.kommune}${headlines ? `: ${headlines}` : "."}`,
      page,
      totalPages: Math.ceil(count / 15),
      hasFilter,
      noindex: count < 1,
      feeds: [{ path: `/${encodeSegment(section.slug)}/${encodeSegment(sub.slug)}/feed.xml`, title: `${sub.navn} – ${site.navn}` }],
    });
  }

  // Ellers tjek artikel (kun på sin egen sektion-sti)
  const articleData = await loadArticle(site.id, sektion, slug);
  if (articleData) {
    const { article, summary, articleMeta, metaMedia } = articleData;
    const seo = resolveArticleSeo({
      base,
      titel: article.titel,
      manchet: article.manchet,
      seoTitel: article.seoTitel,
      seoBeskrivelse: article.seoBeskrivelse,
      slug: article.slug,
      sprog: article.sprog,
      sektion: summary.sektion,
      meta: articleMeta,
      cover: article.coverMedia,
      ogMedia: metaMedia.og,
      twitterMedia: metaMedia.twitter,
      version: article.opdateretTid?.getTime(),
    });
    return buildPageMetadata({
      site,
      path: articlePath(summary.sektion.slug, article.slug),
      title: seo.title,
      ogTitle: seo.og.title,
      description: article.seoBeskrivelse || article.manchet,
      ogDescription: seo.og.description,
      type: "article",
      noindex: seo.noindex,
      nofollow: seo.nofollow,
      canonicalUrl: seo.isCanonicalOverride ? seo.canonical : undefined,
      locale: seo.locale,
      keywords: seo.keywords,
      newsKeywords: seo.newsKeywords,
      unavailableAfter: seo.unavailableAfter,
      standout: seo.standout,
      languages: seo.languages,
      image: seo.og.image,
      twitter: { card: seo.twitter.card, title: seo.twitter.title, description: seo.twitter.description, image: seo.twitter.image },
      article: {
        publishedTime: article.publiceretTid,
        modifiedTime: articleMeta.sistSubstantielOpdateringTid ?? article.opdateretTid,
        expirationTime: articleMeta.udloebTid,
        authorUrls: article.forfatter?.slug ? [`${base}/forfatter/${encodeSegment(article.forfatter.slug)}`] : undefined,
        section: summary.sektion.navn,
        tags: [...article.tags.map((t) => t.navn)],
      },
      feeds: [{ path: `/${encodeSegment(summary.sektion.slug)}/feed.xml`, title: `${summary.sektion.navn} – ${site.navn}` }],
    });
  }

  return {};
}

export default async function SectionOrArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ sektion: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sektion, slug } = await params;
  const query = await searchParams;
  const site = await getCurrentSite();

  // Store bogstaver i sektionsstien (/NYHEDER/...) -> 308 til den rigtige sti.
  if (sektion !== sektion.toLowerCase()) {
    permanentRedirect(`/${encodeSegment(sektion.toLowerCase())}/${encodeSegment(slug)}`);
  }

  // 1. Tjek om slug matcher en undersektion i den aktuelle sektion
  const section = await loadSection(site.id, sektion);

  const isSubcategory = section?.children.some((c) => c.slug === slug);

  if (isSubcategory && section) {
    // RENDER UNDERSEKTIONSSIDE (P-03)
    const areaSlug = typeof query.omraade === "string" ? query.omraade : undefined;
    const page = typeof query.side === "string" ? parseInt(query.side, 10) || 1 : 1;

    const [sectionData, { areas }] = await Promise.all([
      getSectionData(site.id, sektion, {
        subcategorySlug: slug,
        areaSlug,
        page,
        take: 15,
      }),
      getSiteNavigation(site.id),
    ]);

    if (!sectionData || !sectionData.activeSubcategory) {
      notFound();
    }

    const {
      activeSubcategory,
      totalCount,
      hovedhistorie,
      sekundaereTop,
      oevrige,
      mestLaeste,
      totalPages,
    } = sectionData;

    const isDebat = section.slug === "debat";

    // Gruppér øvrige artikler efter dato
    const dateGroups: Array<{ label: string; artikler: typeof oevrige }> = [];
    oevrige.forEach((art) => {
      const dividerLabel = formatDateDivider(art.publiceretTid);
      const existing = dateGroups.find((g) => g.label === dividerLabel);
      if (existing) {
        existing.artikler.push(art);
      } else {
        dateGroups.push({ label: dividerLabel, artikler: [art] });
      }
    });

    return (
      <div className="site-section-page">
        <JsonLd
          data={sectionCollection(
            {
              sektion: { navn: section.navn, slug: section.slug },
              undersektion: { navn: activeSubcategory.navn, slug: activeSubcategory.slug },
              name: `${activeSubcategory.navn} i ${site.kommune}`,
              description: activeSubcategory.beskrivelse ?? undefined,
              items: sectionData.alleArtikler.map((a) => ({ href: a.href })),
            },
            siteBase(site),
          )}
        />
        <div className="site-container">
          {/* Brødkrumme: Forside › Sektion */}
          <Breadcrumbs
            items={[
              { label: "Forside", href: "/" },
              { label: section.navn, href: `/${section.slug}` },
              { label: activeSubcategory.navn },
            ]}
          />

          {/* Sektionshoved med piller og områdefilter */}
          <SectionHeader
            sektionNavn={activeSubcategory.navn}
            sektionSlug={section.slug}
            beskrivelse={activeSubcategory.beskrivelse}
            undersektioner={section.children.map((c) => ({
              id: c.id,
              navn: c.navn,
              slug: c.slug,
            }))}
            aktivUndersektionSlug={slug}
            omraader={areas.map((a) => ({ id: a.id, navn: a.navn, slug: a.slug }))}
            valgtOmraadeSlug={areaSlug}
          />

          <div className="site-section-layout">
            <div className="site-section-main">
              {hovedhistorie ? (
                <div className="site-top-grid">
                  <div className="site-top-hoved">
                    <ArticleCard
                      variant="hoved"
                      article={{
                        titel: hovedhistorie.titel,
                        manchet: hovedhistorie.manchet,
                        href: hovedhistorie.href,
                        sektion: hovedhistorie.sektion.navn,
                        undersektion: hovedhistorie.undersektion?.navn,
                        omraade: hovedhistorie.omraade?.navn,
                        cover: hovedhistorie.coverMedia
                          ? {
                              url: hovedhistorie.coverMedia.url,
                              alt: hovedhistorie.coverMedia.altTekst || hovedhistorie.titel,
                            }
                          : null,
                        forfatter: hovedhistorie.forfatter,
                        publiceret: hovedhistorie.publiceretTid,
                        indholdstype: hovedhistorie.indholdstype,
                        sponsor: hovedhistorie.marking?.sponsor as string | undefined,
                        afsender: hovedhistorie.marking?.afsender as string | undefined,
                        godkendtAf: hovedhistorie.marking?.godkendtAf as string | undefined,
                        debatLabel: isDebat
                          ? (activeSubcategory.navn as "Leder" | "Kommentar" | "Læserbrev") || "Debat"
                          : undefined,
                        breaking: hovedhistorie.breaking,
                      }}
                      headingLevel={2}
                      priority={true}
                    />
                  </div>

                  {sekundaereTop.length > 0 && (
                    <div className="site-top-secondary">
                      {sekundaereTop.map((art) => (
                        <ArticleCard
                          key={art.id}
                          variant="standard"
                          article={{
                            titel: art.titel,
                            href: art.href,
                            sektion: art.sektion.navn,
                            undersektion: art.undersektion?.navn,
                            omraade: art.omraade?.navn,
                            cover: art.coverMedia
                              ? {
                                  url: art.coverMedia.url,
                                  alt: art.coverMedia.altTekst || art.titel,
                                }
                              : null,
                            forfatter: art.forfatter,
                            publiceret: art.publiceretTid,
                            indholdstype: art.indholdstype,
                            sponsor: art.marking?.sponsor as string | undefined,
                            afsender: art.marking?.afsender as string | undefined,
                            godkendtAf: art.marking?.godkendtAf as string | undefined,
                            debatLabel: isDebat
                              ? (activeSubcategory.navn as "Leder" | "Kommentar" | "Læserbrev") || "Debat"
                              : undefined,
                            breaking: art.breaking,
                          }}
                          headingLevel={3}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ color: "var(--ink-2)", fontStyle: "italic", padding: "40px 0" }}>
                  Ingen artikler i denne undersektion endnu.
                </p>
              )}

              {/* Kronologisk liste */}
              {dateGroups.length > 0 && (
                <div className="site-chronological-list" style={{ marginTop: "24px" }}>
                  {dateGroups.map((group) => (
                    <div key={group.label} className="site-date-group">
                      <DateDivider label={group.label} />
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {group.artikler.map((art) => (
                          <ArticleCard
                            key={art.id}
                            variant="kompakt"
                            article={{
                              titel: art.titel,
                              href: art.href,
                              sektion: art.sektion.navn,
                              undersektion: art.undersektion?.navn,
                              omraade: art.omraade?.navn,
                              cover: art.coverMedia
                                ? {
                                    url: art.coverMedia.url,
                                    alt: art.coverMedia.altTekst || art.titel,
                                  }
                                : null,
                              forfatter: art.forfatter,
                              publiceret: art.publiceretTid,
                              indholdstype: art.indholdstype,
                              sponsor: art.marking?.sponsor as string | undefined,
                              afsender: art.marking?.afsender as string | undefined,
                              godkendtAf: art.marking?.godkendtAf as string | undefined,
                              debatLabel: isDebat
                                ? (activeSubcategory.navn as "Leder" | "Kommentar" | "Læserbrev") || "Debat"
                                : undefined,
                              breaking: art.breaking,
                            }}
                            headingLevel={3}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  <LoadMore
                    currentPage={page}
                    totalPages={totalPages}
                    totalCount={totalCount}
                  />
                </div>
              )}
            </div>

            <aside className="site-section-aside">
              {mestLaeste.length > 0 && (
                <div className="site-most-read-card">
                  <h3 className="site-most-read-heading">Mest læst</h3>
                  <ol className="site-most-read-list">
                    {mestLaeste.map((art, idx) => (
                      <li key={art.id} className="site-most-read-item">
                        <span className="site-most-read-num">{idx + 1}</span>
                        <Link href={art.href} className="site-most-read-link">
                          {art.titel}
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <NewsletterSignup siteNavn={site.navn} sektion={activeSubcategory.navn} />
            </aside>
          </div>
        </div>
      </div>
    );
  }

  // 2. Hvis det ikke er en undersektion: Slå artikel op
  const articleData = await loadArticle(site.id, sektion, slug);

  if (!articleData) {
    // Ændret slug/sektion på en publiceret artikel: permanent omdirigering til den nuværende URL (ingen løkker, tenant-afgrænset).
    // Bemærk: Next.js' permanentRedirect svarer 308 (permanent, bevarer metoden) — for GET-sider ens med 301 for søgemaskiner.
    const redirectTo = await findArticleRedirect(site.id, sektion, slug);
    if (redirectTo) permanentRedirect(redirectTo);
    notFound();
  }

  const { article, summary, relaterede, articleMeta, metaMedia, creditAuthors } = articleData;
  const blocks = parseBlocks(article.blocks);
  const primaryArea = article.geoTags[0] ?? null;

  // Forrige/næste historie i samme sektion (kronologisk), til artiklens afslutning
  const sectionCategoryIds = section
    ? [section.id, ...section.children.map((c) => c.id)]
    : article.kategoriId
      ? [article.kategoriId]
      : [];
  const publishedAt = article.publiceretTid ?? new Date();
  const [prevRow, nextRow] =
    sectionCategoryIds.length > 0
      ? await Promise.all([
          db.article.findFirst({
            where: {
              instansId: site.id,
              status: "Publiceret",
              id: { not: article.id },
              kategoriId: { in: sectionCategoryIds },
              publiceretTid: { lt: publishedAt },
            },
            orderBy: { publiceretTid: "desc" },
            select: { titel: true, slug: true },
          }),
          db.article.findFirst({
            where: {
              instansId: site.id,
              status: "Publiceret",
              id: { not: article.id },
              kategoriId: { in: sectionCategoryIds },
              publiceretTid: { gt: publishedAt },
            },
            orderBy: { publiceretTid: "asc" },
            select: { titel: true, slug: true },
          }),
        ])
      : [null, null];
  const prevArticle = prevRow
    ? { titel: stripHtml(prevRow.titel), href: articlePath(summary.sektion.slug, prevRow.slug) }
    : null;
  const nextArticle = nextRow
    ? { titel: stripHtml(nextRow.titel), href: articlePath(summary.sektion.slug, nextRow.slug) }
    : null;

  // Schema.org NewsArticle (type afhænger af indholdstype, jf. lib/seo/jsonld.ts)
  const base = siteBase(site);
  const jsonLd = articleGraph(
    {
      titel: article.titel,
      manchet: article.manchet,
      seoTitel: article.seoTitel,
      seoBeskrivelse: article.seoBeskrivelse,
      bodyText: blocksPlainText(blocks),
      meta: {
        ...articleMeta,
        keywords: articleMeta.keywords,
        medforfattere: articleMeta.medforfattere.map((c) => ({ ...c, slug: creditAuthors.find((x) => x.id === c.authorId)?.slug ?? null })),
        ogImageUrl: metaMedia.og ? absoluteUrl(siteBase(site), metaMedia.og.url) : null,
      },
      slug: article.slug,
      indholdstype: article.indholdstype,
      marking: summary.marking,
      aiBrug: article.aiBrug,
      sprog: article.sprog,
      publiceretTid: article.publiceretTid,
      opdateretTid: article.opdateretTid,
      sektion: summary.sektion,
      undersektion: summary.undersektion,
      forfatter: article.forfatter,
      tags: article.tags,
      geoTags: article.geoTags,
      corrections: article.corrections,
      cover: article.coverMedia,
    },
    site,
    resolveSeoConfig(site),
    base,
  );
  const canonicalUrl = `${base}${articlePath(summary.sektion.slug, article.slug)}`;
  // Eksterne links i betalt/indsendt indhold mærkes (rel=sponsored/ugc).
  const linkRel =
    article.indholdstype === "Partner" || article.indholdstype === "Sponsoreret" || article.indholdstype === "PR"
      ? ["sponsored"]
      : article.indholdstype === "Brugerindsendt"
        ? ["ugc"]
        : undefined;

  const breadcrumbItems = [
    { label: "Forside", href: "/" },
    { label: summary.sektion.navn, href: `/${summary.sektion.slug}` },
    ...(summary.undersektion
      ? [{ label: summary.undersektion.navn, href: `/${summary.sektion.slug}/${summary.undersektion.slug}` }]
      : []),
    { label: article.titel },
  ];

  return (
    <article className="site-article-page">
      <MetricTracker articleId={article.id} />
      <JsonLd data={jsonLd} />

      <div className="site-container">
        <div className="site-article-layout">
          {/* Hovedspalte */}
          <div className="site-article-main">
            {/* Mobil topbar med tilbage-pil og handlinger jf. Mock Screen 3 */}
            <div className="site-article-mobile-topbar site-mobile-only">
              <Link href={`/${summary.sektion.slug}`} className="site-article-back-link">
                <ChevronLeft size={20} aria-hidden="true" />
                <span>Tilbage til {summary.sektion.navn}</span>
              </Link>

              <div className="site-article-mobile-actions">
                <BookmarkButton
                  id={article.id}
                  titel={article.titel}
                  href={summary.href}
                  sektion={summary.sektion.navn}
                />
                <ShareButton url={canonicalUrl} title={article.titel} />
              </div>
            </div>

            {/* Brødkrumme på alle skærmstørrelser */}
            <Breadcrumbs items={breadcrumbItems} />

            {/* Kicker over H1 jf. Mock Screen 3 */}
            <div className="site-kicker" style={{ margin: "8px 0 12px 0" }}>
              <span className="site-kicker-accent">
                {(summary.sektion.navn).toUpperCase()}
              </span>
              <span className="site-kicker-dot">·</span>
              <span className="site-kicker-meta">
                {(primaryArea?.navn || summary.undersektion?.navn || site.kommune).toUpperCase()}
              </span>
            </div>

            {/* Mærkningsboks (hvis ikke Uafhængig) */}
            {article.indholdstype !== "Uafhængig" && (
              <MarkingBox
                indholdstype={article.indholdstype}
                marking={summary.marking as Record<string, unknown>}
              />
            )}

            {/* H1 */}
            <h1 className="site-article-h1">{article.titel}</h1>

            {/* Manchet */}
            {article.manchet && (
              <div
                className="site-article-manchet"
                dangerouslySetInnerHTML={{ __html: normalizeHtml(article.manchet, { linkRel }) }}
              />
            )}

            {/* Byline-række med desktop handlinger til højre jf. Mock Screen 3 */}
            <div className="site-article-byline-row">
              <Byline
                forfatter={article.forfatter}
                publiceretTid={article.publiceretTid ?? new Date()}
                opdateretTid={article.opdateretTid}
              />

              <div className="site-article-actions site-desktop-only">
                <BookmarkButton
                  id={article.id}
                  titel={article.titel}
                  href={summary.href}
                  sektion={summary.sektion.navn}
                />
                <ShareButton url={canonicalUrl} title={article.titel} />
              </div>
            </div>

            {/* Billede (16:9) med billedtekst og kredit */}
            {article.coverMedia && (
              <figure className="site-article-cover">
                <div className="site-article-cover-box" style={{ position: "relative" }}>
                  <Image
                    src={article.coverMedia.url}
                    alt={article.coverMedia.altTekst || article.titel}
                    fill
                    sizes="(max-width: 1024px) 100vw, 720px"
                    priority
                    className="site-article-cover-img"
                  />
                </div>
                {(article.coverMedia.billedtekst || article.coverMedia.ophavsperson) && (
                  <figcaption className="site-article-caption">
                    {article.coverMedia.billedtekst && <span>{article.coverMedia.billedtekst}</span>}
                    {article.coverMedia.ophavsperson && (
                      <span className="site-article-credit">{creditLabel(article.coverMedia.ophavsperson)}</span>
                    )}
                  </figcaption>
                )}
              </figure>
            )}

            {/* 8. Rettelser (hvis relevant jf. DESIGN.md §6 punkt 8) */}
            {article.corrections && article.corrections.length > 0 && (
              <div
                className="site-article-corrections-box"
                role="note"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  padding: "16px 20px",
                  borderRadius: "var(--radius-card)",
                  marginBottom: "24px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <AlertCircle size={17} style={{ color: "var(--site-accent)" }} />
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Præcisering og rettelse
                  </strong>
                </div>
                {article.corrections.map((corr) => (
                  <div key={corr.id} style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: "1.45" }}>
                    <span style={{ fontWeight: "700" }}>{formatFullDate(corr.dato)}: </span>
                    {corr.tekst}
                  </div>
                ))}
                <div style={{ marginTop: "8px" }}>
                  <Link href="/om-mediet/rettelser" style={{ fontSize: "12px", color: "var(--site-accent)", textDecoration: "underline", fontWeight: "600" }}>
                    Læs mere om vores rettelsespolitik →
                  </Link>
                </div>
              </div>
            )}

            {/* 7. Brødtekst med blokke */}
            <SiteBlockRenderer blocks={blocks} linkRel={linkRel} />

            {/* 8. Tags (område og emner) */}
            {(article.geoTags.length > 0 || article.tags.length > 0) && (
              <div className="site-article-tags">
                <span className="site-article-tags-label">Tags:</span>
                {article.geoTags.map((geo) => (
                  <Link
                    key={geo.id}
                    href={`/omraade/${geo.slug || geo.id}`}
                    className="site-article-tag-pill"
                  >
                    📍 {geo.navn}
                  </Link>
                ))}
                {article.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    href={`/emne/${tag.slug || tag.id}`}
                    className="site-article-tag-pill"
                  >
                    #{tag.navn}
                  </Link>
                ))}
              </div>
            )}

            {/* Artiklens afslutning: Støt + tip, derefter mere fra området */}
            <div className="site-article-end">
              <ArticleEndCta siteNavn={site.navn} kommune={site.kommune} />

              {relaterede.length > 0 && (
                <section className="site-related-section" aria-labelledby="related-title">
                  <h2 id="related-title" className="site-section-title-inline">
                    {primaryArea ? `Mere fra ${primaryArea.navn}` : `Mere fra ${summary.sektion.navn}`}
                  </h2>
                  <div className="site-cards-grid-3">
                    {relaterede.map((rel) => (
                      <ArticleCard
                        key={rel.id}
                        variant="standard"
                        article={{
                          titel: rel.titel,
                          href: rel.href,
                          sektion: rel.sektion.navn,
                          undersektion: rel.undersektion?.navn,
                          omraade: rel.omraade?.navn,
                          cover: rel.coverMedia
                            ? { url: rel.coverMedia.url, alt: rel.coverMedia.altTekst || rel.titel }
                            : null,
                          forfatter: rel.forfatter,
                          publiceret: rel.publiceretTid,
                          indholdstype: rel.indholdstype,
                          sponsor: rel.marking?.sponsor as string | undefined,
                          afsender: rel.marking?.afsender as string | undefined,
                          breaking: rel.breaking,
                        }}
                        headingLevel={3}
                      />
                    ))}
                  </div>
                </section>
              )}

              {(prevArticle || nextArticle) && (
                <nav className="site-article-pager" aria-label="Forrige og næste historie">
                  {prevArticle ? (
                    <Link href={prevArticle.href} rel="prev" className="site-article-pager-link">
                      <span className="site-article-pager-label">Forrige historie</span>
                      <span className="site-article-pager-title">{prevArticle.titel}</span>
                    </Link>
                  ) : (
                    <span />
                  )}
                  {nextArticle ? (
                    <Link href={nextArticle.href} rel="next" className="site-article-pager-link is-next">
                      <span className="site-article-pager-label">Næste historie</span>
                      <span className="site-article-pager-title">{nextArticle.titel}</span>
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              )}
            </div>
          </div>

          {/* Sidespalte (desktop): ét nyhedsbrev. Indholdet gentages ikke i hovedspalten. */}
          <aside className="site-section-aside" aria-label="Nyhedsbrev">
            <NewsletterSignup siteNavn={site.navn} sektion={summary.sektion.navn} />
          </aside>
        </div>
      </div>
    </article>
  );
}
