import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { getFrontpageData, getSiteNavigation, getActiveAds } from "@/lib/site-queries";
import { LatestTicker } from "@/components/site/LatestTicker";
import { ArticleCard } from "@/components/site/ArticleCard";
import { ShortNewsList } from "@/components/site/ShortNewsList";
import { NewsletterSignup } from "@/components/site/NewsletterSignup";
import { FirstPartyAd } from "@/components/site/FirstPartyAd";
import { MapPin, Users, ArrowRight } from "lucide-react";

export default async function Frontpage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = await getCurrentSite();
  const params = await searchParams;
  const areaFilter = typeof params.omraade === "string" ? params.omraade : undefined;

  const [data, { areas }, feedAds] = await Promise.all([
    getFrontpageData(site.id, areaFilter),
    getSiteNavigation(site.id),
    getActiveAds(site.id, "feed"),
  ]);

  const feedAd = feedAds[0] ?? null;

  const {
    seneste,
    tophistorie,
    topSekundaere,
    kortNyt,
    omraadeArtikler,
    sektionsBlokke,
    borgerArtikler,
  } = data;

  return (
    <div className="site-frontpage">
      {/* 1. Zone 1: Seneste nyt-ticker */}
      {seneste && <LatestTicker article={seneste} />}

      <div className="site-container">
        {/* 2. Zone 2: Tophistorie (1 hoved + 2 standard) */}
        {tophistorie && (
          <section className="site-top-section" aria-label="Tophistorier">
            <div className="site-top-grid">
              <div className="site-top-hoved">
                <ArticleCard
                  variant="hoved"
                  article={{
                    titel: tophistorie.titel,
                    manchet: tophistorie.manchet,
                    href: tophistorie.href,
                    sektion: tophistorie.sektion.navn,
                    undersektion: tophistorie.undersektion?.navn,
                    omraade: tophistorie.omraade?.navn,
                    cover: tophistorie.coverMedia
                      ? {
                          url: tophistorie.coverMedia.url,
                          alt: tophistorie.coverMedia.altTekst || tophistorie.titel,
                        }
                      : null,
                    forfatter: tophistorie.forfatter,
                    publiceret: tophistorie.publiceretTid,
                    indholdstype: tophistorie.indholdstype,
                    sponsor: tophistorie.marking?.sponsor as string | undefined,
                    afsender: tophistorie.marking?.afsender as string | undefined,
                    godkendtAf: tophistorie.marking?.godkendtAf as string | undefined,
                    breaking: tophistorie.breaking,
                  }}
                  headingLevel={2}
                  priority={true}
                />
              </div>

              {topSekundaere.length > 0 && (
                <div className="site-top-secondary">
                  {topSekundaere.map((art) => (
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
                        breaking: art.breaking,
                      }}
                      headingLevel={3}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* First-Party In-Feed Ad Banner (First-party, cookiefri, respekt for kvoteloft) */}
        {feedAd && <FirstPartyAd campaign={feedAd} />}

        {/* 3 + 4. Zone 3 (Fra dit område) + Zone 4 (Kort nyt) */}
        <section className="site-mid-section" style={{ marginTop: "40px" }} aria-label="Lokale nyheder og kort nyt">
          <div className="site-mid-grid">
            {/* Zone 3: Fra dit område */}
            <div className="site-area-zone">
              <div className="site-zone-heading">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <MapPin size={20} style={{ color: "var(--site-accent)" }} />
                  <span>Fra dit område</span>
                </div>
                {areas.length > 0 && (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {areas.slice(0, 4).map((area) => (
                      <Link
                        key={area.id}
                        href={`/omraade/${area.slug || area.id}`}
                        className="site-pill"
                        style={{ fontSize: "12px", padding: "3px 10px" }}
                      >
                        {area.navn}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {omraadeArtikler.length > 0 ? (
                <div className="site-cards-grid-3">
                  {omraadeArtikler.map((art) => (
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
                        breaking: art.breaking,
                      }}
                      headingLevel={3}
                    />
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--ink-2)", fontStyle: "italic" }}>
                  Ingen artikler fundet for dette område endnu.
                </p>
              )}
            </div>

            {/* Zone 4: Kort nyt */}
            <div className="site-short-news-zone">
              <ShortNewsList artikler={kortNyt} titel="Kort nyt" />
            </div>
          </div>
        </section>

        {/* 7. Zone 7: Sektionsblokke (Nyheder, Sport, Erhverv, Kultur, Foreningsliv, Debat) */}
        <section className="site-section-blocks-zone" style={{ marginTop: "48px" }} aria-label="Nyheder opdelt i sektioner">
          {sektionsBlokke.map(({ sektion, artikler }) => (
            <div key={sektion.slug} className="site-section-block">
              <div className="site-section-block-header">
                <h2 className="site-section-block-title">{sektion.navn}</h2>
                <Link href={`/${sektion.slug}`} className="site-section-block-link">
                  Se alle i {sektion.navn} <ArrowRight size={15} style={{ display: "inline" }} />
                </Link>
              </div>

              <div className="site-cards-grid-4">
                {artikler.map((art) => (
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
                      debatLabel:
                        sektion.slug === "debat"
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
        </section>

        {/* 5. Zone 5: Fra borgerne (Brugerindsendt, spor A) */}
        {borgerArtikler.length > 0 && (
          <section className="site-citizens-section" style={{ marginTop: "40px" }} aria-label="Fra borgerne">
            <div className="site-zone-heading">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={20} style={{ color: "var(--site-accent)" }} />
                <span>Fra borgerne</span>
              </div>
              <Link
                href="/indsend"
                className="site-section-block-link"
                style={{ fontSize: "14px" }}
              >
                Indsend dit indlæg →
              </Link>
            </div>

            <div className="site-cards-grid-3">
              {borgerArtikler.map((art) => (
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
                    afsender: art.marking?.afsender as string | undefined,
                    breaking: art.breaking,
                  }}
                  headingLevel={3}
                />
              ))}
            </div>
          </section>
        )}

        {/* 10. Zone 10: Nyhedsbrevsmodul */}
        <div style={{ marginTop: "56px" }}>
          <NewsletterSignup siteNavn={site.navn} />
        </div>
      </div>
    </div>
  );
}
