import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentSite } from "@/lib/site";
import { getSectionData, getSiteNavigation, formatDateDivider } from "@/lib/site-queries";
import { db } from "@/lib/db";
import { JsonLd } from "@/components/site/JsonLd";
import { analyzeQuery, buildPageMetadata } from "@/lib/seo/meta";
import { sectionCollection } from "@/lib/seo/jsonld";
import { encodeSegment, siteBase } from "@/lib/seo/url";
import { stripHtml } from "@/lib/seo/escape";
import { SectionHeader } from "@/components/site/SectionHeader";
import { ArticleCard } from "@/components/site/ArticleCard";
import { DateDivider } from "@/components/site/DateDivider";
import { LoadMore } from "@/components/site/LoadMore";
import { NewsletterSignup } from "@/components/site/NewsletterSignup";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Gamle emne-links (/nyheder?emne=trafik) pegede på samme side; de omdirigeres nu til de rigtige undersektioner.
const LEGACY_TOPIC_REDIRECTS: Record<string, string> = {
  nabolag: "/omraade",
  sundhed: "/nyheder/sundhed",
  skole: "/nyheder/skole-og-boern",
  trafik: "/nyheder/trafik",
  krimi: "/nyheder/krimi-og-retsvaesen",
  bolig: "/nyheder/bolig-og-byudvikling",
  natur: "/nyheder/natur-og-klima",
  politik: "/nyheder/politik",
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ sektion: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { sektion } = await params;
  const query = searchParams ? await searchParams : {};
  const site = await getCurrentSite();
  const section = await db.category.findFirst({
    where: { instansId: site.id, slug: sektion, parentId: null },
    include: { children: { select: { id: true } } },
  });
  if (!section) return {};

  // Filtrerede visninger (?omraade, ?filter, ?emne …) er dubletter: canonical til ren URL + noindex,follow.
  const { page, hasFilter } = analyzeQuery(query);
  const where = {
    instansId: site.id,
    status: "Publiceret",
    kategoriId: { in: [section.id, ...section.children.map((c) => c.id)] },
  };
  const [count, top] = await Promise.all([
    db.article.count({ where }),
    db.article.findMany({ where, orderBy: { publiceretTid: "desc" }, take: 3, select: { titel: true } }),
  ]);
  const headlines = top.map((t) => stripHtml(t.titel)).join(" · ");

  return buildPageMetadata({
    site,
    path: `/${encodeSegment(section.slug)}`,
    title: `${section.navn} fra ${site.kommune} – seneste lokale historier`,
    description:
      section.beskrivelse && section.beskrivelse.length >= 70
        ? section.beskrivelse
        : `${section.beskrivelse ? `${section.beskrivelse}. ` : ""}Seneste lokale ${section.navn.toLowerCase()} fra ${site.kommune}${headlines ? `: ${headlines}` : "."}`,
    page,
    totalPages: Math.ceil(count / 15),
    hasFilter,
    noindex: count < 1,
    feeds: [{ path: `/${encodeSegment(section.slug)}/feed.xml`, title: `${section.navn} – ${site.navn}` }],
  });
}

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sektion: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sektion } = await params;
  const query = await searchParams;
  const site = await getCurrentSite();

  const areaSlug = typeof query.omraade === "string" ? query.omraade : undefined;
  const filter = typeof query.filter === "string" ? query.filter : undefined;
  const legacyEmne = typeof query.emne === "string" ? query.emne : undefined;
  if (legacyEmne && LEGACY_TOPIC_REDIRECTS[legacyEmne]) {
    permanentRedirect(LEGACY_TOPIC_REDIRECTS[legacyEmne]);
  }
  const page = typeof query.side === "string" ? parseInt(query.side, 10) || 1 : 1;

  const [sectionData, { areas }] = await Promise.all([
    getSectionData(site.id, sektion, { areaSlug, page, take: 15, filter }),
    getSiteNavigation(site.id),
  ]);

  if (!sectionData) {
    notFound();
  }

  const {
    section,
    totalCount,
    hovedhistorie,
    sekundaereTop,
    oevrige,
    subcategoryBlocks,
    mestLaeste,
    totalPages,
  } = sectionData;

  const isDebat = section.slug === "debat";

  // Gruppér øvrige artikler efter dato til DateDividers
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
            name: `${section.navn} fra ${site.kommune}`,
            description: section.beskrivelse ?? undefined,
            items: sectionData.alleArtikler.map((a) => ({ href: a.href })),
          },
          siteBase(site),
        )}
      />
      <div className="site-container">
        {/* Sektionshoved med piller og områdefilter */}
        <SectionHeader
          sektionNavn={section.navn}
          sektionSlug={section.slug}
          beskrivelse={section.beskrivelse}
          undersektioner={section.children.map((c) => ({ id: c.id, navn: c.navn, slug: c.slug }))}
          omraader={areas.map((a) => ({ id: a.id, navn: a.navn, slug: a.slug }))}
          valgtOmraadeSlug={areaSlug}
        />

        {filter === "mest-laest" && (
          <p style={{ margin: "0 0 12px 0", fontSize: 14, color: "var(--ink-2)" }}>
            Sorteret efter mest læst. <Link href={`/${section.slug}`} style={{ textDecoration: "underline" }}>Vis seneste i stedet</Link>
          </p>
        )}

        <div className="site-section-layout">
          {/* Hovedspalte */}
          <div className="site-section-main">
            {/* Topsektion: 1 hoved + 2 standard */}
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
                        ? (hovedhistorie.undersektion?.navn as "Leder" | "Kommentar" | "Læserbrev") || "Debat"
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
                            ? (art.undersektion?.navn as "Leder" | "Kommentar" | "Læserbrev") || "Debat"
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
                Der er endnu ingen artikler i denne sektion.
              </p>
            )}

            {/* Undersektionsblokke (kun side 1, hvis intet områdefilter er valgt) */}
            {subcategoryBlocks.length > 0 && (
              <div className="site-subcategory-blocks" style={{ marginTop: "16px" }}>
                {subcategoryBlocks.map(({ subcategory, artikler }) => (
                  <div key={subcategory.slug} className="site-section-block">
                    <div className="site-section-block-header">
                      <h3 className="site-section-block-title">{subcategory.navn}</h3>
                      <Link
                        href={`/${section.slug}/${subcategory.slug}`}
                        className="site-section-block-link"
                      >
                        Se alle i {subcategory.navn}{" "}
                        <ArrowRight size={14} style={{ display: "inline" }} />
                      </Link>
                    </div>

                    <div className="site-cards-grid-3">
                      {artikler.map((art) => (
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
                              ? (art.undersektion?.navn as "Leder" | "Kommentar" | "Læserbrev") || "Debat"
                              : undefined,
                            breaking: art.breaking,
                          }}
                          headingLevel={3}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Kronologisk artikelliste med dato-skillelinjer */}
            {dateGroups.length > 0 && (
              <div className="site-chronological-list" style={{ marginTop: "24px" }}>
                <h3 className="site-zone-heading">Flere artikler i {section.navn}</h3>
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
                              ? (art.undersektion?.navn as "Leder" | "Kommentar" | "Læserbrev") || "Debat"
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

            {/* Erhvervs kontakt- og inspirationscallout */}
            {section.slug === "erhverv" && (
              <div className="site-commercial-callout">
                <div>
                  <h3 className="site-commercial-callout-title">
                    Vil du i kontakt med lokale virksomheder?
                  </h3>
                  <p className="site-commercial-callout-desc">
                    Find jobmuligheder, virksomhedsprofiler og inspiration fra det lokale erhvervsliv i {site.kommune}.
                  </p>
                </div>
                <Link href="/om-mediet/kontakt" className="site-commercial-callout-action">
                  Kontakt redaktionen →
                </Link>
              </div>
            )}
          </div>

          {/* Sidespalte (desktop >= 1024px) */}
          <aside className="site-section-aside">
            {mestLaeste.length > 0 && (
              <div className="site-most-read-card">
                <h3 className="site-most-read-heading">Mest læst i {section.navn}</h3>
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

            {areas.length > 0 && (
              <div className="site-most-read-card">
                <h3 className="site-most-read-heading">Områder i {site.kommune}</h3>
                <ul className="site-most-read-list" style={{ listStyle: "none", padding: 0 }}>
                  {areas.map((a) => (
                    <li key={a.id} className="site-most-read-item">
                      <Link href={`/omraade/${a.slug}`} className="site-most-read-link">
                        {a.navn}
                      </Link>
                    </li>
                  ))}
                  <li className="site-most-read-item">
                    <Link href="/omraade" className="site-most-read-link">
                      Alle områder →
                    </Link>
                  </li>
                </ul>
              </div>
            )}

            <NewsletterSignup siteNavn={site.navn} sektion={section.navn} />
          </aside>
        </div>
      </div>
    </div>
  );
}
