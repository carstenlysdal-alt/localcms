import Link from "next/link";
import Image from "next/image";
import { getCurrentSite } from "@/lib/site";
import { getFrontpageData, getSiteNavigation, getActiveAds, formatRelativeTime } from "@/lib/site-queries";
import { LatestTicker } from "@/components/site/LatestTicker";
import { ArticleCard } from "@/components/site/ArticleCard";
import { BlivEnDelAfJournalistikkenBlock } from "@/components/site/BlivEnDelAfJournalistikkenBlock";
import { TopicFilterBar } from "@/components/site/TopicFilterBar";
import { CommunityBoardBlock } from "@/components/site/CommunityBoardBlock";
import { BeaconPartners } from "@/components/site/BeaconPartners";
import { NewsletterSignup } from "@/components/site/NewsletterSignup";
import { FirstPartyAd } from "@/components/site/FirstPartyAd";
import { MapPin, Mail, ChevronRight, ArrowRight } from "lucide-react";

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
    sektionsBlokke,
  } = data;

  // Formater dagsaktuel dato pænt på dansk (f.eks. "Tirsdag 30. september")
  const todayFormatted = new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const capitalizedDate = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  // Saml de 5 seneste nyheder til midterkolonnen i top-grid jf. mockup
  const rawWireArtikler = [
    ...(topSekundaere || []),
    ...(kortNyt || []),
    seneste,
  ].filter(Boolean);

  const fallbackWireItems = [
    {
      time: "08:12",
      title: "Nyt flertal på rådhuset vil investere 45 millioner i bymidten",
      href: "/nyheder/nyt-flertal-paa-raadhuset-bymidte-investering",
    },
    {
      time: "07:48",
      title: "Dagens overblik: Det besluttede Slagelse Byråd",
      href: "/nyheder/dagens-overblik-byraadet-beslutninger",
    },
    {
      time: "06:32",
      title: "Flere sommerhuse udsat for indbrud ved Skælskør Næs",
      href: "/nyheder/indbrudsboelge-sommerhuse-skaelskoer-naes",
    },
    {
      time: "22:11",
      title: "Ny butikskæde åbner i Slagelse til foråret",
      href: "/erhverv/ny-butikskaede-aabner-slagelse-foraar",
    },
    {
      time: "21:05",
      title: "Unge stifter idé, der skal gøre genbrug lettere i kommunen",
      href: "/kultur/unge-stifter-groen-genbrugside-slagelse",
    },
  ];

  const wireListItems = fallbackWireItems.map((fallback, idx) => {
    const dbArt = rawWireArtikler[idx];
    if (dbArt) {
      const d = new Date(dbArt.publiceretTid);
      const timeStr = !isNaN(d.getTime())
        ? d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })
        : fallback.time;
      return {
        time: timeStr,
        title: dbArt.titel,
        href: dbArt.href || fallback.href,
      };
    }
    return fallback;
  });

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

        {/* Emne- og kategorifilter-pillebjælke med byvælger 📍 */}
        <TopicFilterBar currentCity={site.kommune} />

        {/* ------------------------------------------------------------------
            ZONE 1: NYT BLØDT 3-KOLONNET FORSIDELAYOUT (Mockup desktop & mobil)
        ------------------------------------------------------------------- */}
        <section className="site-top-3col-grid" aria-label="Tophistorier og overblik">
          {/* Kolonne 1: Hero Overlay Card med Storebælt og bløde hjørner */}
          <div className="site-hero-overlay-card">
            <Image
              src={tophistorie?.coverMedia?.url || "/media/storebaelt_hero.jpg"}
              alt={tophistorie?.coverMedia?.altTekst || "Storebæltsbroen i aftenlys"}
              fill
              sizes="(max-width: 1024px) 100vw, 680px"
              priority
              className="site-hero-overlay-bg"
              style={{ objectFit: "cover" }}
            />
            <div className="site-hero-overlay-gradient" />

            <div className="site-hero-overlay-content">
              <div className="site-hero-overlay-kicker">
                {tophistorie
                  ? `${tophistorie.sektion.navn.toUpperCase()} · ${(tophistorie.omraade?.navn || site.kommune).toUpperCase()}`
                  : "TRAFIK · STOREBÆLT"}
              </div>

              <h1 className="site-hero-overlay-title">
                <Link href={tophistorie?.href || "/trafik/koedannelse-storebaeltsbroen-fyn"}>
                  {tophistorie?.titel || "Kødannelse på Storebæltsbroen i retning mod Fyn efter trafikuheld"}
                </Link>
              </h1>

              <p className="site-hero-overlay-manchet">
                {tophistorie?.manchet ||
                  "Et trafikuheld spærrer et spor på Storebæltsbroen. Bilister skal forvente længere rejsetid, oplyser politiet."}
              </p>

              <div className="site-hero-overlay-actions">
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                  <Link
                    href={tophistorie?.href || "/trafik/koedannelse-storebaeltsbroen-fyn"}
                    className="site-hero-btn-read"
                  >
                    <span>Læs artiklen</span>
                    <ArrowRight size={15} />
                  </Link>

                  <div className="site-hero-overlay-byline">
                    <span>{tophistorie?.forfatter?.navn || "Jonas Vestergaard"}</span>
                    <span>·</span>
                    <span>
                      {tophistorie?.publiceretTid
                        ? formatRelativeTime(tophistorie.publiceretTid)
                        : "2 t. siden"}
                    </span>
                  </div>
                </div>

                <Link href="/trafik/live" className="site-hero-live-pill">
                  <span className="site-hero-live-dot" />
                  <span>LIVE</span>
                  <span style={{ opacity: 0.85 }}>Se trafiksituationen →</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Kolonne 2: Seneste nyt Card */}
          <div className="site-wire-card">
            <h2 className="site-wire-card-header">Seneste nyt</h2>
            <div className="site-wire-list">
              {wireListItems.map((item, idx) => (
                <div key={idx} className="site-wire-item">
                  <span className="site-wire-time-pill">{item.time}</span>
                  <p className="site-wire-title">
                    <Link href={item.href}>{item.title}</Link>
                  </p>
                </div>
              ))}
            </div>
            <div className="site-wire-footer">
              <Link href="/nyheder" className="site-wire-footer-link">
                Se alle nyheder →
              </Link>
            </div>
          </div>

          {/* Kolonne 3: Utility Column (Vejr, Nabolag, Nyhedsbrev) */}
          <div className="site-utility-stack">
            {/* 1. Vejr kort */}
            <div className="site-utility-card site-weather-widget">
              <div>
                <div className="site-weather-temp-row">
                  <span style={{ fontSize: "22px" }}>⛅</span>
                  <span className="site-weather-temp">12°</span>
                  <span className="site-weather-city">{site.kommune}</span>
                </div>
                <div className="site-weather-date">{capitalizedDate}</div>
              </div>
              <ChevronRight size={18} style={{ color: "var(--ink-3)" }} />
            </div>

            {/* 2. Dit nabolag kort med geografisk illustration */}
            <div className="site-utility-card">
              <div className="site-neighborhood-card-thumb">
                <Image
                  src="/media/nabolag_kort.jpg"
                  alt={`Kort over ${site.kommune} nabolag`}
                  fill
                  sizes="300px"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <h3 className="site-neighborhood-title">Dit nabolag</h3>
              <p className="site-neighborhood-desc">Nyheder tæt på dig. Vælg område.</p>
              <form action="/" method="GET">
                <select
                  name="omraade"
                  defaultValue={areaFilter || ""}
                  className="site-neighborhood-select"
                  aria-label="Vælg område i kommunen"
                >
                  <option value="">Hele kommunen</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.slug}>
                      {a.navn}
                    </option>
                  ))}
                </select>
              </form>
            </div>

            {/* 3. Nyhedsbrev mini-kort */}
            <div className="site-utility-card site-newsletter-mini-card">
              <div className="site-newsletter-mini-header">
                <div className="site-newsletter-mini-icon">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="site-newsletter-mini-title">Få nyhederne direkte i din indbakke</h3>
                  <p className="site-newsletter-mini-desc">
                    Lokale historier, analyser og debatindlæg. Ingen reklamer.
                  </p>
                </div>
              </div>
              <form
                action="/api/newsletter/subscribe"
                method="POST"
                className="site-newsletter-mini-form"
              >
                <input
                  type="email"
                  name="email"
                  placeholder="Indtast din e-mail"
                  required
                  className="site-newsletter-mini-input"
                  aria-label="E-mailadresse til nyhedsbrev"
                />
                <button type="submit" className="site-newsletter-mini-btn">
                  Tilmeld
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------
            ZONE 2: MELLEMSTE RÆKKE: 3 VANDRETTE KORT (Mockup midtersektion)
        ------------------------------------------------------------------- */}
        <section className="site-middle-3cards-grid" aria-label="Fremhævede historier">
          {/* Kort 1: Politik / Bymidte */}
          <article className="site-middle-card">
            <div className="site-middle-card-content">
              <span className="site-middle-card-kicker">POLITIK · SLAGELSE BY</span>
              <h3 className="site-middle-card-title">
                <Link href="/politik/nyt-flertal-byraadet-investerer-45-millioner-bymidten">
                  Nyt flertal på rådhuset vil investere 45 millioner i bymidten
                </Link>
              </h3>
              <p className="site-middle-card-manchet">
                En bred aftale mellem fem partier skal puste nyt liv i gågaden og torvet med mere grønt og færre tomme butiksvinduer.
              </p>
              <div className="site-middle-card-byline">
                <span>Rikke Møller</span>
                <span> · </span>
                <span>4 min. siden</span>
              </div>
            </div>
            <div className="site-middle-card-thumb">
              <Image
                src="/media/slagelse_bymidte.jpg"
                alt="Slagelse bymidte gågade"
                fill
                sizes="115px"
                style={{ objectFit: "cover" }}
              />
            </div>
          </article>

          {/* Kort 2: Bolig / Sommerhuse */}
          <article className="site-middle-card">
            <div className="site-middle-card-content">
              <span className="site-middle-card-kicker">BOLIG · UDVIKLING</span>
              <h3 className="site-middle-card-title">
                <Link href="/bolig/flere-sommerhuse-udsat-for-indbrud-skaelskoer-naes">
                  Flere sommerhuse udsat for indbrud ved Skælskør Næs
                </Link>
              </h3>
              <p className="site-middle-card-manchet">
                Politiet opfordrer grundejere til at sikre boliger, efter flere tyverier i weekenden.
              </p>
              <div className="site-middle-card-byline">
                <span>3 t. siden</span>
              </div>
            </div>
            <div className="site-middle-card-thumb">
              <Image
                src="/media/skaelskoer_sommerhus.jpg"
                alt="Sommerhuse ved Skælskør kyst"
                fill
                sizes="115px"
                style={{ objectFit: "cover" }}
              />
            </div>
          </article>

          {/* Kort 3: Erhverv / Butikskæde */}
          <article className="site-middle-card">
            <div className="site-middle-card-content">
              <span className="site-middle-card-kicker">ERHVERV · DETAIL</span>
              <h3 className="site-middle-card-title">
                <Link href="/erhverv/ny-butikskaede-aabner-slagelse-foraar">
                  Ny butikskæde åbner i Slagelse til foråret
                </Link>
              </h3>
              <p className="site-middle-card-manchet">
                Kæden etablerer 800 m² butik på tidligere industrigrund og skaber 20 nye jobs.
              </p>
              <div className="site-middle-card-byline">
                <span>1 t. siden</span>
              </div>
            </div>
            <div className="site-middle-card-thumb">
              <Image
                src="/media/slagelse_erhverv.jpg"
                alt="Moderne butik i Slagelse"
                fill
                sizes="115px"
                style={{ objectFit: "cover" }}
              />
            </div>
          </article>
        </section>

        {/* ------------------------------------------------------------------
            ZONE 3: MERE FRA SLAGELSE (MED FANER & 4-KORT GRID)
        ------------------------------------------------------------------- */}
        <section className="site-bottom-section" aria-label="Mere lokalt indhold">
          <div className="site-bottom-header">
            <h2 className="site-bottom-title">Mere fra {site.kommune}</h2>
            <div className="site-bottom-tabs">
              <span className="site-bottom-tab is-active">Udvalgt til dig</span>
              <Link href="/nyheder?filter=mest-laest" className="site-bottom-tab">
                Mest læst
              </Link>
              <Link href="/nyheder?filter=lige-nu" className="site-bottom-tab">
                Lokalt lige nu
              </Link>
              <Link href="/nyheder?filter=analyse" className="site-bottom-tab">
                Analyse
              </Link>
            </div>
          </div>

          <div className="site-bottom-4grid">
            {/* Kort 1: Sport & Fodbold */}
            <article className="site-bottom-card">
              <div className="site-bottom-card-media">
                <Image
                  src="/media/slagelse_fodbold.jpg"
                  alt="Børn der spiller fodbold i Slagelse"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className="site-bottom-card-body">
                <span className="site-bottom-card-kicker">SPORT · FORENINGSLIV</span>
                <h3 className="site-bottom-card-title">
                  <Link href="/sport/det-sker-i-slagelse-5-oplevelser-weekenden">
                    Det sker i Slagelse: 5 oplevelser i weekenden
                  </Link>
                </h3>
                <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.45, margin: "0 0 10px 0" }}>
                  Fra lokal fodbold til musik og markeder – her er ugens bedste oplevelser i kommunen.
                </p>
                <div className="site-bottom-card-byline">
                  <span>Redaktionen · Fredag</span>
                </div>
              </div>
            </article>

            {/* Kort 2: Natur & Vådområder */}
            <article className="site-bottom-card">
              <div className="site-bottom-card-media">
                <Image
                  src="/media/tude_aa_natur.jpg"
                  alt="Tude Å kano og vådområde natur"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className="site-bottom-card-body">
                <span className="site-bottom-card-kicker">NATUR · KLIMA</span>
                <h3 className="site-bottom-card-title">
                  <Link href="/natur/kommunen-vil-genskabe-vaadomraader-langs-tude-aa">
                    Kommunen vil genskabe vådområder langs Tude Å
                  </Link>
                </h3>
                <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.45, margin: "0 0 10px 0" }}>
                  Nyt projekt skal reducere oversvømmelser og styrke biodiversiteten i vandløbet.
                </p>
                <div className="site-bottom-card-byline">
                  <span>Jonas Vestergaard · I går</span>
                </div>
              </div>
            </article>

            {/* Kort 3: Debat / Læserbrev */}
            <article className="site-bottom-card">
              <div className="site-bottom-card-media">
                <Image
                  src="/media/debat_skriver.jpg"
                  alt="Person der skriver læserbrev"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className="site-bottom-card-body">
                <span className="site-bottom-card-kicker">DEBAT</span>
                <h3 className="site-bottom-card-title">
                  <Link href="/debat/laeserbrev-slagelse-har-brug-for-ny-plan">
                    Læserbrev: Slagelse har brug for en ny plan
                  </Link>
                </h3>
                <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.45, margin: "0 0 10px 0" }}>
                  Vi har råd til at tænke længere frem, skriver lokal debattør om kommunens retning.
                </p>
                <div className="site-bottom-card-byline">
                  <span>Lars Henriksen · 7 t. siden</span>
                </div>
              </div>
            </article>

            {/* Kort 4: Erhverv & Uddannelse */}
            <article className="site-bottom-card">
              <div className="site-bottom-card-media">
                <Image
                  src="/media/slagelse_erhverv.jpg"
                  alt="Erhvervssamarbejde i Slagelse"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <div className="site-bottom-card-body">
                <span className="site-bottom-card-kicker">ERHVERV · UDDANNELSE</span>
                <h3 className="site-bottom-card-title">
                  <Link href="/erhverv/nyt-samarbejde-lokale-virksomheder-og-erhvervsskole">
                    Nyt samarbejde mellem lokale virksomheder og erhvervsskole
                  </Link>
                </h3>
                <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.45, margin: "0 0 10px 0" }}>
                  Flere lærlingepiloter skal sikre, at unge faglærte bliver i kommunen efter endt uddannelse.
                </p>
                <div className="site-bottom-card-byline">
                  <span>Carsten Lysdal · 5 t. siden</span>
                </div>
              </div>
            </article>
          </div>
        </section>

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

        {/* Den Lokale Opslagstavle */}
        <CommunityBoardBlock siteNavn={site.navn} kommuneNavn={site.kommune} />

        {/* Fyrtårnspartnere strip */}
        <BeaconPartners kommuneNavn={site.kommune} />
      </div>
    </div>
  );
}
