import { Suspense } from "react";
import { pageMeta } from "@/lib/seo/page-meta";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import {
  Radio,
  Trophy,
  Flame,
  ShieldCheck,
  Calendar,
  Handshake,
  FileText,
  Award,
} from "lucide-react";
import { MeddelerPortalClient } from "../meddeler/MeddelerPortalClient";
import { SponsorBriefForm } from "../sponsor/SponsorBriefForm";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/bliv-en-del-af-journalistikken", (site) => ({
    title: "Bliv en del af journalistikken",
    description: `Tip redaktionen, rapportér lokale begivenheder eller indgå et gennemsigtigt lokalt erhvervspartnerskab med ${site.navn}.`,
  }));
}

export default async function BlivEnDelAfJournalistikkenPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = await getCurrentSite();
  const params = await searchParams;
  const isErhverv = params?.spor === "erhverv";

  return (
    <div className="site-page-container" style={{ padding: "28px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "860px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Bliv en del af journalistikken" },
          ]}
        />

        {/* Hero sektion */}
        <header className="site-page-header" style={{ marginBottom: "28px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "var(--site-accent-soft)",
              color: "var(--site-accent)",
              padding: "5px 14px",
              borderRadius: "var(--radius-pill)",
              fontSize: "12.5px",
              fontWeight: "700",
              marginBottom: "14px",
            }}
          >
            <Radio size={15} />
            <span>Fællesskab & Engagement</span>
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
            Bliv en del af journalistikken i {site.kommune}
          </h1>

          <p
            className="site-page-desc"
            style={{
              fontSize: "18px",
              color: "var(--ink-2)",
              lineHeight: "1.5",
              margin: 0,
            }}
          >
            Lokaljournalistik er et fælles anliggende. Uanset om du er borger med et tip fra hverdagen,
            en forening med en god historie eller en lokal virksomhed, der vil styrke lokalområdet,
            har du en direkte vej ind i avisen.
          </p>
        </header>

        {/* To-spors fanevælger: For borgere vs For virksomheder & sponsorer */}
        <nav
          aria-label="Vælg spor"
          style={{
            display: "flex",
            gap: "12px",
            borderBottom: "2px solid var(--line)",
            marginBottom: "36px",
            paddingBottom: "0",
          }}
        >
          <Link
            href="/bliv-en-del-af-journalistikken?spor=borger"
            style={{
              padding: "12px 20px",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              fontWeight: "700",
              textDecoration: "none",
              color: !isErhverv ? "var(--site-accent)" : "var(--ink-2)",
              borderBottom: !isErhverv ? "3px solid var(--site-accent)" : "3px solid transparent",
              marginBottom: "-2px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.15s ease",
            }}
          >
            <Radio size={16} />
            <span>For borgere & meddelere</span>
          </Link>

          <Link
            href="/bliv-en-del-af-journalistikken?spor=erhverv"
            style={{
              padding: "12px 20px",
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              fontWeight: "700",
              textDecoration: "none",
              color: isErhverv ? "var(--site-accent)" : "var(--ink-2)",
              borderBottom: isErhverv ? "3px solid var(--site-accent)" : "3px solid transparent",
              marginBottom: "-2px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.15s ease",
            }}
          >
            <Handshake size={16} />
            <span>For virksomheder & sponsorer</span>
          </Link>
        </nav>

        {/* 1. SPOR: BORGERJOURNALISTIK & MEDDELER */}
        {!isErhverv && (
          <div>
            {/* 4 primære spor for indberetning */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
                marginBottom: "36px",
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: "700",
                    fontSize: "15px",
                    marginBottom: "8px",
                    color: "var(--ink)",
                  }}
                >
                  <Radio size={18} style={{ color: "var(--site-accent)" }} />
                  Tip redaktionen
                </div>
                <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45" }}>
                  Har du set eller hørt noget, redaktionen bør undersøge? Fuld kildebeskyttelse og fortrolighed.
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: "700",
                    fontSize: "15px",
                    marginBottom: "8px",
                    color: "var(--ink)",
                  }}
                >
                  <Flame size={18} style={{ color: "var(--site-accent)" }} />
                  Akutte hændelser
                </div>
                <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45" }}>
                  Uheld, vejrspærringer, beredskab eller markant vejr i dit lokalområde. Du er på stedet.
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: "700",
                    fontSize: "15px",
                    marginBottom: "8px",
                    color: "var(--ink)",
                  }}
                >
                  <Trophy size={18} style={{ color: "var(--site-accent)" }} />
                  Sport & Foreningsliv
                </div>
                <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45" }}>
                  Kampreferater, oprykninger, resultater, stævner og generalforsamlinger fra lokale klubber.
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontWeight: "700",
                    fontSize: "15px",
                    marginBottom: "8px",
                    color: "var(--ink)",
                  }}
                >
                  <Calendar size={18} style={{ color: "var(--site-accent)" }} />
                  Arrangementer & Nyt
                </div>
                <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45" }}>
                  Få byens koncerter, bylaugsmøder, loppemarkeder og foredrag med i den lokale kalender.
                </p>
              </div>
            </div>

            {/* Meddeler platform interaktiv klient */}
            <Suspense
              fallback={
                <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-3)" }}>
                  Indlæser meddelerpanel...
                </div>
              }
            >
              <MeddelerPortalClient kommuneNavn={site.kommune} />
            </Suspense>

            {/* Sådan arbejder redaktionen */}
            <section
              style={{
                marginTop: "48px",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-card)",
                padding: "28px 24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <ShieldCheck size={20} style={{ color: "var(--site-accent)" }} />
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "22px", margin: 0, color: "var(--ink)" }}>
                  Sådan behandler redaktionen dit tip og din historie
                </h2>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "20px",
                  marginTop: "16px",
                }}
              >
                <div>
                  <h3 style={{ fontSize: "14.5px", fontWeight: "700", color: "var(--ink)", margin: "0 0 6px 0" }}>
                    1. Kildebeskyttelse og anonymitet
                  </h3>
                  <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.5" }}>
                    Du kan altid vælge at tippe os fortroligt. Redaktionen værner om kildebeskyttelse i henhold til medieansvarsloven.
                  </p>
                </div>

                <div>
                  <h3 style={{ fontSize: "14.5px", fontWeight: "700", color: "var(--ink)", margin: "0 0 6px 0" }}>
                    2. Redaktionel vurdering
                  </h3>
                  <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.5" }}>
                    Alle indberetninger gennemgås af journalister. Vi faktatjekker oplysninger og kontakter berørte parter for en balanceret dækning.
                  </p>
                </div>

                <div>
                  <h3 style={{ fontSize: "14.5px", fontWeight: "700", color: "var(--ink)", margin: "0 0 6px 0" }}>
                    3. Din personlige nøglekode
                  </h3>
                  <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.5" }}>
                    Når du indsender, modtager du en nøglekode. Den giver dig adgang til at følge status på sagen i dit eget meddelerpanel.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* 2. SPOR: LOKALE VIRKSOMHEDER & SPONSORER */}
        {isErhverv && (
          <div>
            {/* Principper for partnerindhold */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-card)",
                padding: "24px 28px",
                marginBottom: "32px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                <ShieldCheck size={20} style={{ color: "var(--site-accent)" }} />
                <h2 style={{ margin: 0, fontSize: "18px", fontFamily: "var(--font-serif)", color: "var(--ink)" }}>
                  Gennemsigtigt lokalt partnerskab & sponsorindhold
                </h2>
              </div>
              <p style={{ fontSize: "14px", color: "var(--ink-2)", margin: "0 0 14px 0", lineHeight: "1.5" }}>
                Lokale virksomheder og arbejdspladser er med til at forme hverdagen og udviklingen i {site.kommune}. Vi tilbyder gennemskuelige samarbejdsformater,
                hvor din virksomhed kan fortælle om projekter, medarbejdere og faglig viden med fuld troværdighed over for læserne:
              </p>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.6" }}>
                <li>Alt partnerindhold mærkes synligt i toppen med <strong>◆ FINANSIERET AF [Virksomhedsnavn]</strong>.</li>
                <li>Partneren godkender fakta, tal og citater, mens den journalistiske tone forbliver sober og læsevenlig.</li>
                <li>Historierne integreres naturligt i sitets sektioner (Erhverv, Kultur, Bolig) og på forsiden.</li>
              </ul>
            </div>

            {/* Samarbejdsformater */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "16px",
                marginBottom: "36px",
              }}
            >
              <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "20px", borderRadius: "var(--radius-card)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>
                  <FileText size={18} style={{ color: "var(--site-accent)" }} />
                  Sponsoreret artikel
                </div>
                <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45" }}>
                  En dybdegående artikel om din virksomheds udvikling, medarbejdere eller samfundsengagement.
                </p>
              </div>

              <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "20px", borderRadius: "var(--radius-card)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>
                  <Award size={18} style={{ color: "var(--site-accent)" }} />
                  Fyrtårnspartnerskab
                </div>
                <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45" }}>
                  Helårligt samarbejde med fast synlighed i bunden af sitet, native artikler og nyhedsbrev.
                </p>
              </div>
            </div>

            {/* Sponsor brief formular */}
            <SponsorBriefForm siteNavn={site.navn} />
          </div>
        )}
      </div>
    </div>
  );
}
