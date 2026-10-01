import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import {
  Calendar,
  FileText,
  Store,
  Mail,
  Handshake,
  Award,
  Sparkles,
  Share2,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { SponsorBriefForm } from "../sponsor/SponsorBriefForm";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Priser & Annoncering — ${site.navn}`,
    description: `Gennemskuelige, lave introrater for lokale virksomheder og arrangører i ${site.kommune}. Sponsorerede artikler, kalenderannoncer og faste partnerskaber.`,
  };
}

export default async function PriserPage() {
  const site = await getCurrentSite();

  return (
    <div className="site-page-container" style={{ padding: "28px 0 80px 0" }}>
      <div className="site-container" style={{ maxWidth: "1000px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Bliv en del af journalistikken", href: "/bliv-en-del-af-journalistikken" },
            { label: "Priser & Annoncering" },
          ]}
        />

        {/* HERO INTRO BANNER */}
        <header className="site-page-header" style={{ marginBottom: "36px", textAlign: "left" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--site-accent-soft)",
              color: "var(--site-accent)",
              padding: "6px 14px",
              borderRadius: "9999px",
              fontSize: "12.5px",
              fontWeight: "700",
              marginBottom: "16px",
            }}
          >
            <Sparkles size={15} />
            <span>Særlige Opstartspriser · Spar 75 % ift. traditionelle bymedier</span>
          </div>

          <h1
            className="site-page-title"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "38px",
              lineHeight: "1.15",
              margin: "0 0 14px 0",
              color: "var(--ink)",
            }}
          >
            Lokal synlighed i {site.kommune} til priser, alle kan betale
          </h1>

          <p
            className="site-page-desc"
            style={{
              fontSize: "17.5px",
              color: "var(--ink-2)",
              lineHeight: "1.55",
              margin: 0,
              maxWidth: "820px",
            }}
          >
            På {site.navn} mener vi, at lokal markedsføring og synlighed skal være tilgængeligt for alle —
            fra den lokale forening og kaffebar til håndværkeren og områdets større arbejdspladser.
            Vores priser starter på cirka <strong>25 % af de takster, som store bymedier som Min By Media tager</strong>.
            Til gengæld lover vi ægte lokal forankring, høj journalistisk kvalitet og fuld distribution på Facebook.
          </p>
        </header>

        {/* 3 NØGLEFORDELE */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "20px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>
              <Share2 size={20} style={{ color: "var(--site-accent)" }} />
              Distribution inkluderet
            </div>
            <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.5" }}>
              Når du køber en sponsoreret artikel, deler vi den altid direkte på vores aktive Facebook-side og i nyhedsbrevet — uden merpris.
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "20px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>
              <CheckCircle2 size={20} style={{ color: "var(--site-accent)" }} />
              Journalistisk håndværk
            </div>
            <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.5" }}>
              Vores journalister hjælper med at finde den gode vinkel, foretage interviewet og sikre et sobert, læsevenligt sprog.
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "20px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>
              <HelpCircle size={20} style={{ color: "var(--site-accent)" }} />
              100 % Gennemskueligt
            </div>
            <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.5" }}>
              Tydelig mærkning med <strong>◆ FINANSIERET AF</strong>. Ingen skjulte gebyrer, ingen bindinger og ingen ubehagelige overraskelser.
            </p>
          </div>
        </div>

        {/* 1. SEKTION: ENKELTSTÅENDE PRODUKTER (LAVESTE STARTPRISER) */}
        <section style={{ marginBottom: "50px" }}>
          <div style={{ marginBottom: "20px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--site-accent)", letterSpacing: "0.05em" }}>
              Enkeltstående formater
            </span>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", margin: "4px 0 0 0", color: "var(--ink)" }}>
              Hvad koster de enkelte produkter?
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            {/* Produkt 1: Event i kalenderen */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-card)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "17px", color: "var(--ink)" }}>
                    <Calendar size={20} style={{ color: "var(--site-accent)" }} />
                    Event i kalenderen
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: "700", background: "#fef3c7", color: "#92400e", padding: "3px 8px", borderRadius: "999px" }}>
                    Laveste pris
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "28px", fontWeight: "800", color: "var(--ink)" }}>125 kr.</span>
                  <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>pr. arrangement (ex. moms)</span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "14px", textDecoration: "line-through" }}>
                  Markedspris hos bymedier: 499 kr.
                </div>
                <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45", marginBottom: "16px" }}>
                  Få jeres koncert, foreningsmøde, loppemarked eller sportsbegivenhed vist i kommunens kalender &quot;Det Sker&quot;.
                </p>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.6" }}>
                  <li>Dato, starttidspunkt og stedvisning</li>
                  <li>Billede og fyldestgørende programbeskrivelse</li>
                  <li>Direkte link til jeres billetsalg el. hjemmeside</li>
                  <li><strong>Gratis for ikke-kommercielle foreninger</strong></li>
                </ul>
              </div>
              <div style={{ marginTop: "20px" }}>
                <Link
                  href="/bliv-en-del-af-journalistikken?spor=borger"
                  className="site-header-btn-solid"
                  style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "10px 16px" }}
                >
                  Opret event i kalenderen →
                </Link>
              </div>
            </div>

            {/* Produkt 2: Sponsoreret artikel */}
            <div
              style={{
                background: "var(--surface)",
                border: "2px solid var(--site-accent)",
                borderRadius: "var(--radius-card)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "var(--shadow-card)",
                position: "relative",
              }}
            >
              <div style={{ position: "absolute", top: "-11px", right: "20px", background: "var(--site-accent)", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "2px 10px", borderRadius: "999px" }}>
                Mest populære
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "17px", color: "var(--ink)", marginBottom: "12px" }}>
                  <FileText size={20} style={{ color: "var(--site-accent)" }} />
                  Sponsoreret artikel
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "28px", fontWeight: "800", color: "var(--ink)" }}>4.995 kr.</span>
                  <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>samlet pakke (ex. moms)</span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "14px", textDecoration: "line-through" }}>
                  Markedspris hos Min By: 25.995 - 33.995 kr.
                </div>
                <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45", marginBottom: "16px" }}>
                  En velskrevet profilartikel om din virksomhed, et nyt tiltag, lærlinge eller et jubilæum. Vi står for produktion og rækkevidde.
                </p>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.6" }}>
                  <li>Journalistisk interview og vinkling</li>
                  <li>Fotoserie af medarbejdere og virksomhed</li>
                  <li>Fast placering på forsiden og i Erhvervssektionen</li>
                  <li><strong>Delt på mediets Facebook-side til tusindvis af lokale</strong></li>
                  <li>Omtale i det ugentlige fredagsnyhedsbrev</li>
                  <li>Fuld brugsret til artiklen i egne kanaler</li>
                </ul>
              </div>
              <div style={{ marginTop: "20px" }}>
                <a
                  href="#bestil"
                  className="site-header-btn-solid"
                  style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "10px 16px" }}
                >
                  Bestil sponsoreret artikel →
                </a>
              </div>
            </div>

            {/* Produkt 3: Profil i guiden */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-card)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", fontSize: "17px", color: "var(--ink)", marginBottom: "12px" }}>
                  <Store size={20} style={{ color: "var(--site-accent)" }} />
                  Profil i Lokalguiden
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "28px", fontWeight: "800", color: "var(--ink)" }}>249 kr.</span>
                  <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>/ md. (ex. moms)</span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--ink-3)", marginBottom: "14px", textDecoration: "line-through" }}>
                  Markedspris hos Min By: 995 kr./md.
                </div>
                <p style={{ fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45", marginBottom: "16px" }}>
                  For restauranter, caféer, butikker og oplevelsessteder. Bliv fundet i Spise- & Handelsguiden, når lokale og gæster søger.
                </p>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.6" }}>
                  <li>Egen flot profilside med logo og fotos</li>
                  <li>Visning af åbningstider, adresse og Google-kort</li>
                  <li>Direkte knap til bordbestilling eller webshop</li>
                  <li>Løbende SEO-optimering på lokale søgeord</li>
                  <li>Ingen binding — kan opsiges måned for måned</li>
                </ul>
              </div>
              <div style={{ marginTop: "20px" }}>
                <a
                  href="#bestil"
                  className="site-header-btn-solid"
                  style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "10px 16px" }}
                >
                  Få din virksomhed i guiden →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 2. SEKTION: FASTE PARTNERSKABSPAKKER (MÅNEDLIG / ÅRLIG STØTTE) */}
        <section style={{ marginBottom: "50px" }}>
          <div style={{ marginBottom: "20px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--site-accent)", letterSpacing: "0.05em" }}>
              Helårligt samarbejde
            </span>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", margin: "4px 0 0 0", color: "var(--ink)" }}>
              Faste erhvervspartnerskaber
            </h2>
            <p style={{ margin: "6px 0 0 0", fontSize: "14px", color: "var(--ink-2)" }}>
              Ønsker din virksomhed kontinuerlig synlighed og at bakke op om byens lokale journalistik året rundt?
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            {/* Pakke 1: Naboskab */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-card)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", margin: "0 0 4px 0" }}>
                  1. Naboskab
                </h3>
                <div style={{ fontSize: "12.5px", color: "var(--ink-3)", marginBottom: "12px" }}>
                  Mindre virksomheder & lokale håndværkere
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "26px", fontWeight: "800", color: "var(--ink)" }}>795 kr.</span>
                  <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>/ md. (el. 7.995 kr./år)</span>
                </div>
                <ul style={{ margin: "16px 0", paddingLeft: "18px", fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.6" }}>
                  <li><strong>2 sponsorerede artikler</strong> årligt</li>
                  <li>4 delinger på sociale medier</li>
                  <li>Logo i partnerlisten i footeren</li>
                  <li>Omtale i kvartalsvis &quot;Lokalt Erhverv&quot; sektion</li>
                  <li>Fuld brugsret til artikler i eget marketing</li>
                </ul>
              </div>
              <a
                href="#bestil"
                className="site-header-btn-solid"
                style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "10px 16px" }}
              >
                Vælg Naboskab →
              </a>
            </div>

            {/* Pakke 2: Fællesskab */}
            <div
              style={{
                background: "var(--surface)",
                border: "2px solid var(--site-accent)",
                borderRadius: "var(--radius-card)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "var(--shadow-card)",
                position: "relative",
              }}
            >
              <div style={{ position: "absolute", top: "-11px", right: "20px", background: "var(--site-accent)", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "2px 10px", borderRadius: "999px" }}>
                Anbefalet
              </div>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", margin: "0 0 4px 0" }}>
                  2. Fællesskab
                </h3>
                <div style={{ fontSize: "12.5px", color: "var(--ink-3)", marginBottom: "12px" }}>
                  Mellemstore virksomheder, mæglere & advokater
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "26px", fontWeight: "800", color: "var(--ink)" }}>1.995 kr.</span>
                  <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>/ md. (el. 19.995 kr./år)</span>
                </div>
                <ul style={{ margin: "16px 0", paddingLeft: "18px", fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.6" }}>
                  <li><strong>4 sponsorerede artikler</strong> årligt</li>
                  <li><strong>1 videoproduktion (Reels/video)</strong> til sociale medier</li>
                  <li>8 målrettede delinger på Facebook og LinkedIn</li>
                  <li>Fast roterende logo på forsiden under &quot;Lokale Partnere&quot;</li>
                  <li>1 eksklusivt indslag i nyhedsbrevet pr. kvartal</li>
                  <li>Kvartalsvist statusmøde med redaktionen</li>
                </ul>
              </div>
              <a
                href="#bestil"
                className="site-header-btn-solid"
                style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "10px 16px" }}
              >
                Vælg Fællesskab →
              </a>
            </div>

            {/* Pakke 3: Fyrtårn */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-card)",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", margin: "0 0 4px 0" }}>
                  3. Fyrtårn
                </h3>
                <div style={{ fontSize: "12.5px", color: "var(--ink-3)", marginBottom: "12px" }}>
                  Pengeinstitutter, energiselskaber & store aktører
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "26px", fontWeight: "800", color: "var(--ink)" }}>4.495 kr.</span>
                  <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>/ md. (el. 45.000 kr./år)</span>
                </div>
                <ul style={{ margin: "16px 0", paddingLeft: "18px", fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.6" }}>
                  <li><strong>8 sponsorerede artikler</strong> og reportager årligt</li>
                  <li><strong>2 professionelle videoproduktioner</strong></li>
                  <li>Permanent logo på forsiden som &quot;Fyrtårnspartner&quot;</li>
                  <li>Månedlig omtale i nyhedsbrevet</li>
                  <li>Prioriteret distribution og betalt boost af historier</li>
                  <li>Mulighed for regional tilstedeværelse i hele [By]Lokalt netværket</li>
                </ul>
              </div>
              <a
                href="#bestil"
                className="site-header-btn-solid"
                style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "10px 16px" }}
              >
                Vælg Fyrtårnspartnerskab →
              </a>
            </div>
          </div>
        </section>

        {/* 3. SEKTION: BESTILLING / BRIEF-FORMULAR */}
        <section id="bestil" style={{ marginTop: "40px" }}>
          <div style={{ marginBottom: "20px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", color: "var(--site-accent)", letterSpacing: "0.05em" }}>
              Bestil eller kontakt redaktionen
            </span>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "26px", margin: "4px 0 0 0", color: "var(--ink)" }}>
              Kom i gang — send dine oplysninger her
            </h2>
            <p style={{ margin: "6px 0 0 0", fontSize: "14px", color: "var(--ink-2)" }}>
              Udfyld nedenstående formular, så kontakter vi dig hurtigst muligt for at aftale detaljer, dato og vinkling.
            </p>
          </div>

          <SponsorBriefForm siteNavn={site.navn} />
        </section>
      </div>
    </div>
  );
}
