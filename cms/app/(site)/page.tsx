import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata, analyzeQuery } from "@/lib/seo/meta";
import Image from "next/image";
import { getCurrentSite, getNetworkLinks } from "@/lib/site";
import { getFrontpageData, getSiteNavigation, getActiveAds, formatRelativeTime } from "@/lib/site-queries";
import { getFrontpageExtras } from "@/lib/site-frontpage";
import { LatestTicker } from "@/components/site/LatestTicker";
import { ArticleCard } from "@/components/site/ArticleCard";
import { BlivEnDelAfJournalistikkenBlock } from "@/components/site/BlivEnDelAfJournalistikkenBlock";
import { TopicFilterBar } from "@/components/site/TopicFilterBar";
import { CommunityBoardBlock } from "@/components/site/CommunityBoardBlock";
import { BeaconPartners } from "@/components/site/BeaconPartners";
import { FirstPartyAd } from "@/components/site/FirstPartyAd";
import { AreaPicker } from "@/components/site/AreaPicker";
import { NewsletterMiniForm } from "@/components/site/NewsletterMiniForm";
import { MapPin, Mail, ChevronRight, ArrowRight, CalendarDays } from "lucide-react";

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const site = await getCurrentSite();
  const { hasFilter } = analyzeQuery(searchParams ? await searchParams : {});
  return buildPageMetadata({
    site,
    path: "/",
    title: `${site.navn} – lokale nyheder fra ${site.kommune}`,
    titleAbsolute: true,
    description: `${site.tagline}. Læs de seneste lokale nyheder, sport, erhverv, kultur og debat fra ${site.kommune} og omegn.`,
    hasFilter,
  });
}

export default async function Frontpage() {
  const site = await getCurrentSite();

  const [data, { categories, areas }, feedAds, networkLinks] = await Promise.all([
    getFrontpageData(site.id),
    getSiteNavigation(site.id),
    getActiveAds(site.id, "feed"),
    getNetworkLinks(),
  ]);

  const feedAd = feedAds[0] ?? null;
  const { seneste, tophistorie, topSekundaere, omraadeArtikler, borgerArtikler, sektionsBlokke } = data;

  const extras = await getFrontpageExtras(
    site.id,
    [tophistorie, ...topSekundaere, ...omraadeArtikler].filter(Boolean).map((a) => a!.id),
  );
  const { senesteNyt, trafik, mereFra, partners } = extras;

  const sectionPaths = categories.flatMap((c) => [
    `/${c.slug}`,
    ...c.children.map((sub) => `/${c.slug}/${sub.slug}`),
  ]);

  // Formater dagsaktuel dato pænt på dansk (f.eks. "Tirsdag 30. september")
  const todayFormatted = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const capitalizedDate = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  const heroCover = tophistorie?.coverMedia ?? null;

  return (
    <div className="site-frontpage">
      {/* 1. Seneste nyt-ticker */}
      {seneste && <LatestTicker article={seneste} />}

      <div className="site-container">
        {/* Mobil udgave- og lokalitetsstatus */}
        <div className="site-mobile-edition-bar site-mobile-only">
          <div className="site-mobile-edition-city">
            <MapPin size={13} style={{ color: "var(--site-accent)" }} />
            <span>{site.kommune}</span>
          </div>
          <div className="site-mobile-edition-date">
            <span>{capitalizedDate}</span>
          </div>
        </div>

        {/* Emne- og kategorifilter-pillebjælke med byvælger */}
        <TopicFilterBar currentCity={site.kommune} networkSites={networkLinks} sectionPaths={sectionPaths} />

        {/* ZONE 1: 3-kolonnet topområde */}
        <section className="site-top-3col-grid" aria-label="Tophistorier og overblik">
          {/* Kolonne 1: Tophistorie */}
          <div
            className="site-hero-overlay-card"
            style={!heroCover ? { background: "var(--site-accent-strong)" } : undefined}
          >
            {heroCover && (
              <Image
                src={heroCover.url}
                alt={heroCover.altTekst || tophistorie?.titel || ""}
                fill
                sizes="(max-width: 1024px) 100vw, 680px"
                priority
                className="site-hero-overlay-bg"
                style={{ objectFit: "cover" }}
              />
            )}
            <div className="site-hero-overlay-gradient" />

            <div className="site-hero-overlay-content">
              {tophistorie ? (
                <>
                  <div className="site-hero-overlay-kicker">
                    {`${tophistorie.sektion.navn.toUpperCase()} · ${(tophistorie.omraade?.navn || site.kommune).toUpperCase()}`}
                  </div>

                  <h1 className="site-hero-overlay-title">
                    <Link href={tophistorie.href}>{tophistorie.titel}</Link>
                  </h1>

                  {tophistorie.manchet && <p className="site-hero-overlay-manchet">{tophistorie.manchet}</p>}

                  <div className="site-hero-overlay-actions">
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                      <Link href={tophistorie.href} className="site-hero-btn-read">
                        <span>Læs artiklen</span>
                        <ArrowRight size={15} />
                      </Link>

                      <div className="site-hero-overlay-byline">
                        {tophistorie.forfatter?.navn && (
                          <>
                            <span>{tophistorie.forfatter.navn}</span>
                            <span>·</span>
                          </>
                        )}
                        <span>{formatRelativeTime(tophistorie.publiceretTid)}</span>
                      </div>
                    </div>

                    {trafik && (
                      <Link href={trafik.href} className="site-hero-live-pill">
                        <span className="site-hero-live-dot" />
                        <span>TRAFIK</span>
                        <span style={{ opacity: 0.85 }}>Seneste trafikmelding →</span>
                      </Link>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="site-hero-overlay-kicker">{site.kommune.toUpperCase()}</div>
                  <h1 className="site-hero-overlay-title">Velkommen til {site.navn}</h1>
                  <p className="site-hero-overlay-manchet">
                    Der er endnu ikke publiceret nogen historier. Har du et tip eller en historie fra {site.kommune}?
                  </p>
                  <div className="site-hero-overlay-actions">
                    <Link href="/indsend" className="site-hero-btn-read">
                      <span>Send et tip til redaktionen</span>
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Kolonne 2: Seneste nyt (pr. by) */}
          <div className="site-wire-card">
            <h2 className="site-wire-card-header">Seneste nyt</h2>
            <div className="site-wire-list">
              {senesteNyt.length > 0 ? (
                senesteNyt.map((item) => (
                  <div key={item.id} className="site-wire-item">
                    <span className="site-wire-time-pill">
                      {new Date(item.publiceretTid).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <p className="site-wire-title">
                      <Link href={item.href}>{item.titel}</Link>
                    </p>
                  </div>
                ))
              ) : (
                <p className="site-wire-title" style={{ padding: "8px 0" }}>
                  Ingen nyheder endnu. <Link href="/indsend">Tip redaktionen</Link>
                </p>
              )}
            </div>
            <div className="site-wire-footer">
              <Link href="/nyheder" className="site-wire-footer-link">
                Se alle nyheder →
              </Link>
            </div>
          </div>

          {/* Kolonne 3: Det sker, nabolag og nyhedsbrev */}
          <div className="site-utility-stack">
            <Link href="/kalender" className="site-utility-card site-weather-widget" style={{ textDecoration: "none", color: "inherit" }}>
              <div>
                <div className="site-weather-temp-row">
                  <CalendarDays size={22} style={{ color: "var(--site-accent)" }} />
                  <span className="site-weather-city">Det sker i {site.kommune}</span>
                </div>
                <div className="site-weather-date">{capitalizedDate}</div>
              </div>
              <ChevronRight size={18} style={{ color: "var(--ink-3)" }} />
            </Link>

            {/* Dit nabolag: rigtige områder for byen */}
            <div className="site-utility-card">
              <h3 className="site-neighborhood-title">Dit nabolag</h3>
              <p className="site-neighborhood-desc">Nyheder tæt på dig. Vælg område.</p>
              {areas.length > 0 ? (
                <>
                  <AreaPicker areas={areas.map((a) => ({ id: a.id, navn: a.navn, slug: a.slug }))} />
                  <p style={{ margin: "10px 0 0 0", fontSize: 13 }}>
                    <Link href="/omraade" style={{ color: "var(--site-accent)", fontWeight: 600 }}>
                      Se alle områder i {site.kommune} →
                    </Link>
                  </p>
                </>
              ) : (
                <p className="site-neighborhood-desc">Områderne i {site.kommune} er ikke oprettet endnu.</p>
              )}
            </div>

            {/* Nyhedsbrev mini-kort */}
            <div className="site-utility-card site-newsletter-mini-card">
              <div className="site-newsletter-mini-header">
                <div className="site-newsletter-mini-icon">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="site-newsletter-mini-title">Få nyhederne direkte i din indbakke</h3>
                  <p className="site-newsletter-mini-desc">
                    Lokale historier fra {site.kommune}. <Link href="/nyhedsbrev">Se alle valgmuligheder</Link>
                  </p>
                </div>
              </div>
              <NewsletterMiniForm />
            </div>
          </div>
        </section>

        {/* ZONE 2: Fra dit område */}
        {omraadeArtikler.length > 0 && (
          <section className="site-middle-3cards-grid" aria-label="Fra dit område">
            {omraadeArtikler.map((art) => (
              <article key={art.id} className="site-middle-card">
                <div className="site-middle-card-content">
                  <span className="site-middle-card-kicker">
                    {[art.sektion.navn, art.omraade?.navn].filter(Boolean).join(" · ").toUpperCase()}
                  </span>
                  <h3 className="site-middle-card-title">
                    <Link href={art.href}>{art.titel}</Link>
                  </h3>
                  {art.manchet && <p className="site-middle-card-manchet">{art.manchet}</p>}
                  <div className="site-middle-card-byline">
                    {art.forfatter?.navn && (
                      <>
                        <span>{art.forfatter.navn}</span>
                        <span> · </span>
                      </>
                    )}
                    <span>{formatRelativeTime(art.publiceretTid)}</span>
                  </div>
                </div>
                {art.coverMedia && (
                  <div className="site-middle-card-thumb">
                    <Image src={art.coverMedia.url} alt={art.coverMedia.altTekst || art.titel} fill sizes="115px" style={{ objectFit: "cover" }} />
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        {/* ZONE 3: Mere fra byen */}
        {mereFra.length > 0 && (
          <section className="site-bottom-section" aria-label="Mere lokalt indhold">
            <div className="site-bottom-header">
              <h2 className="site-bottom-title">Mere fra {site.kommune}</h2>
              <div className="site-bottom-tabs">
                <span className="site-bottom-tab is-active">Seneste</span>
                <Link href="/nyheder?filter=mest-laest" className="site-bottom-tab">
                  Mest læst
                </Link>
                <Link href="/omraade" className="site-bottom-tab">
                  Områder
                </Link>
              </div>
            </div>

            <div className="site-bottom-4grid">
              {mereFra.map((art) => (
                <article key={art.id} className="site-bottom-card">
                  {art.coverMedia && (
                    <div className="site-bottom-card-media">
                      <Image
                        src={art.coverMedia.url}
                        alt={art.coverMedia.altTekst || art.titel}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        style={{ objectFit: "cover" }}
                      />
                    </div>
                  )}
                  <div className="site-bottom-card-body">
                    <span className="site-bottom-card-kicker">
                      {[art.sektion.navn, art.undersektion?.navn].filter(Boolean).join(" · ").toUpperCase()}
                    </span>
                    <h3 className="site-bottom-card-title">
                      <Link href={art.href}>{art.titel}</Link>
                    </h3>
                    {art.manchet && (
                      <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.45, margin: "0 0 10px 0" }}>
                        {art.manchet}
                      </p>
                    )}
                    <div className="site-bottom-card-byline">
                      <span>
                        {art.forfatter?.navn ? `${art.forfatter.navn} · ` : ""}
                        {formatRelativeTime(art.publiceretTid)}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* In-Feed First-Party Annonce */}
        {feedAd && <FirstPartyAd campaign={feedAd} />}

        {/* Bliv en del af journalistikken & Tip redaktionen */}
        <BlivEnDelAfJournalistikkenBlock siteNavn={site.navn} kommuneNavn={site.kommune} />

        {/* Sektionsblokke (Nyheder, Sport, Erhverv, Kultur, Foreningsliv, Debat) */}
        <section className="site-section-blocks-zone" aria-label="Nyheder opdelt i sektioner">
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

        {/* Den Lokale Opslagstavle (borgerindsendt indhold for netop denne by) */}
        <CommunityBoardBlock siteNavn={site.navn} kommuneNavn={site.kommune} posts={borgerArtikler} />

        {/* Fyrtårnspartnere (aktive støtteaftaler for byen) */}
        <BeaconPartners kommuneNavn={site.kommune} partners={partners} />
      </div>
    </div>
  );
}
