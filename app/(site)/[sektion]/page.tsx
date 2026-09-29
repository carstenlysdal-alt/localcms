import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentSite } from "@/lib/site";
import { getSectionData, getSiteNavigation, formatDateDivider } from "@/lib/site-queries";
import { SectionHeader } from "@/components/site/SectionHeader";
import { ArticleCard } from "@/components/site/ArticleCard";
import { DateDivider } from "@/components/site/DateDivider";
import { LoadMore } from "@/components/site/LoadMore";
import { NewsletterSignup } from "@/components/site/NewsletterSignup";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sektion: string }>;
}): Promise<Metadata> {
  const { sektion } = await params;
  const site = await getCurrentSite();
  const data = await getSectionData(site.id, sektion);
  if (!data) return {};

  return {
    title: data.section.navn,
    description:
      data.section.beskrivelse || `Seneste lokale nyheder om ${data.section.navn.toLowerCase()} i ${site.kommune}.`,
  };
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
  const page = typeof query.side === "string" ? parseInt(query.side, 10) || 1 : 1;

  const [sectionData, { areas }] = await Promise.all([
    getSectionData(site.id, sektion, { areaSlug, page, take: 15 }),
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

            <NewsletterSignup siteNavn={site.navn} sektion={section.navn} />
          </aside>
        </div>
      </div>
    </div>
  );
}
