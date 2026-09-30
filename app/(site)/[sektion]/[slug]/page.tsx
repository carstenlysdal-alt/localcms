import { notFound } from "next/navigation";
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
import { SiteBlockRenderer } from "@/components/site/blocks/SiteBlockRenderer";
import { parseBlocks } from "@/lib/blocks/schema";
import { db } from "@/lib/db";
import { AlertCircle } from "lucide-react";
import { MetricTracker } from "@/components/site/MetricTracker";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sektion: string; slug: string }>;
}): Promise<Metadata> {
  const { sektion, slug } = await params;
  const site = await getCurrentSite();

  // Tjek først om det er en undersektion
  const section = await db.category.findFirst({
    where: { instansId: site.id, slug: sektion, parentId: null },
    include: { children: true },
  });

  if (section) {
    const sub = section.children.find((c) => c.slug === slug);
    if (sub) {
      return {
        title: `${sub.navn} — ${section.navn}`,
        description: `Nyheder om ${sub.navn.toLowerCase()} i ${site.kommune}.`,
      };
    }
  }

  // Ellers tjek artikel
  const articleData = await getArticleBySlug(site.id, sektion, slug);
  if (articleData) {
    const { article } = articleData;
    return {
      title: article.seoTitel || article.titel,
      description: article.seoBeskrivelse || article.manchet || undefined,
      openGraph: {
        title: article.titel,
        description: article.manchet || undefined,
        type: "article",
        publishedTime: article.publiceretTid?.toISOString(),
        modifiedTime: article.opdateretTid?.toISOString(),
        images: article.coverMedia ? [{ url: article.coverMedia.url }] : [],
      },
      alternates: {
        canonical: `https://${site.domaene}/${sektion}/${slug}`,
      },
    };
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

  // 1. Tjek om slug matcher en undersektion i den aktuelle sektion
  const section = await db.category.findFirst({
    where: { instansId: site.id, slug: sektion, parentId: null },
    include: { children: { orderBy: { sortering: "asc" } } },
  });

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
  const articleData = await getArticleBySlug(site.id, sektion, slug);

  if (!articleData) {
    notFound();
  }

  const { article, summary, relaterede } = articleData;
  const blocks = parseBlocks(article.blocks);
  const primaryArea = article.geoTags[0] ?? null;

  // Schema.org NewsArticle data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.titel,
    description: article.manchet || undefined,
    datePublished: article.publiceretTid?.toISOString(),
    dateModified: article.opdateretTid?.toISOString(),
    isAccessibleForFree: true,
    author: article.forfatter
      ? {
          "@type": "Person",
          name: article.forfatter.navn,
          ...(article.forfatter.slug
            ? { url: `https://${site.domaene}/forfatter/${article.forfatter.slug}` }
            : {}),
        }
      : {
          "@type": "Organization",
          name: site.navn,
        },
    publisher: {
      "@type": "NewsMediaOrganization",
      name: site.navn,
      url: `https://${site.domaene}`,
      publishingPrinciples: `https://${site.domaene}/om-mediet/redaktionelle-principper`,
    },
    ...(article.corrections && article.corrections.length > 0
      ? {
          correction: article.corrections.map((c) => ({
            "@type": "CorrectionComment",
            text: c.tekst,
            datePublished: c.dato.toISOString(),
            url: `https://${site.domaene}/om-mediet/rettelser`,
          })),
        }
      : {}),
    ...(article.coverMedia ? { image: [article.coverMedia.url] } : {}),
    ...(primaryArea ? { contentLocation: { "@type": "Place", name: primaryArea.navn } } : {}),
  };

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="site-container">
        <div className="site-article-layout">
          {/* Hovedspalte */}
          <div className="site-article-main">
            {/* 1. Brødkrumme */}
            <Breadcrumbs items={breadcrumbItems} />

            {/* 2. Mærkningsboks (hvis ikke Uafhængig) */}
            {article.indholdstype !== "Uafhængig" && (
              <MarkingBox
                indholdstype={article.indholdstype}
                marking={summary.marking as Record<string, unknown>}
              />
            )}

            {/* 3. H1 */}
            <h1 className="site-article-h1">{article.titel}</h1>

            {/* 4. Manchet */}
            {article.manchet && <p className="site-article-manchet">{article.manchet}</p>}

            {/* 5. Byline */}
            <Byline
              forfatter={article.forfatter}
              publiceretTid={article.publiceretTid ?? new Date()}
              opdateretTid={article.opdateretTid}
            />

            {/* 6. Billede (16:9) med billedtekst og kredit */}
            {article.coverMedia && (
              <figure className="site-article-cover">
                <div className="site-article-cover-box">
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
                      <span className="site-article-credit">Foto: {article.coverMedia.ophavsperson}</span>
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
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  borderLeft: "4px solid var(--site-accent)",
                  padding: "16px 20px",
                  borderRadius: "0 var(--radius-card) var(--radius-card) 0",
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
            <SiteBlockRenderer blocks={blocks} />

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

            {/* 11. Relaterede artikler */}
            {relaterede.length > 0 && (
              <section className="site-related-section" style={{ marginTop: "48px" }}>
                <h3 className="site-zone-heading">
                  Mere fra {summary.omraade?.navn || summary.sektion.navn}
                </h3>
                <div className="site-cards-grid-3">
                  {relaterede.map((rel) => (
                    <ArticleCard
                      key={rel.id}
                      variant="kompakt"
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
                      headingLevel={4}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 12. Nyhedsbrevsmodul */}
            <div style={{ marginTop: "48px" }}>
              <NewsletterSignup siteNavn={site.navn} sektion={summary.sektion.navn} />
            </div>
          </div>

          {/* Sidespalte på desktop */}
          <aside className="site-section-aside">
            {relaterede.length > 0 && (
              <div className="site-most-read-card">
                <h3 className="site-most-read-heading">Læs også</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {relaterede.map((rel) => (
                    <ArticleCard
                      key={rel.id}
                      variant="kompakt"
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
                      headingLevel={4}
                    />
                  ))}
                </div>
              </div>
            )}

            <NewsletterSignup siteNavn={site.navn} />
          </aside>
        </div>
      </div>
    </article>
  );
}
