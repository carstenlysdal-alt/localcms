import type { Metadata } from "next";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import {
  Radio,
  Trophy,
  Flame,
  Landmark,
  ShieldCheck,
  Mic,
  Calendar,
  Sparkles,
  HelpCircle,
  FileText,
} from "lucide-react";
import { MeddelerPortalClient } from "../meddeler/MeddelerPortalClient";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Bliv en del af journalistikken — Tip redaktionen & Meddelerplatformen | ${site.navn}`,
    description: `Bliv en del af journalistikken for ${site.navn}. Tip redaktionen, send en akut hændelse, rapporter fra din sportsklub eller indsend din historie.`,
  };
}

export default async function BlivEnDelAfJournalistikkenPage() {
  const site = await getCurrentSite();

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
        <header className="site-page-header" style={{ marginBottom: "32px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(158, 61, 27, 0.1)",
              color: "var(--site-accent, #9E3D1B)",
              padding: "5px 14px",
              borderRadius: "9999px",
              fontSize: "12.5px",
              fontWeight: "700",
              marginBottom: "14px",
            }}
          >
            <Radio size={15} />
            <span>Lokalt kildenetværk & borgerjournalistik</span>
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
            Ingen kender lokalsamfundet bedre end dem, der selv bor, arbejder og færdes her.
            Vores meddelerplatform giver dig en direkte vej ind til redaktionen på {site.navn}.
            Tip os om en sag, rapportér en akut hændelse, beret fra din sportsklub eller indsend
            din egen historie via tekst, tale og billeder.
          </p>
        </header>

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
              boxShadow: "var(--shadow-card)",
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
              <Radio size={18} style={{ color: "var(--site-accent, #9E3D1B)" }} />
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
              boxShadow: "var(--shadow-card)",
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
              <Flame size={18} style={{ color: "#dc2626" }} />
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
              boxShadow: "var(--shadow-card)",
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
              <Trophy size={18} style={{ color: "#2563eb" }} />
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
              boxShadow: "var(--shadow-card)",
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
              <Calendar size={18} style={{ color: "#16a34a" }} />
              Arrangementer & Nyt
            </div>
            <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45" }}>
              Få byens koncerter, bylaugsmøder, loppemarkeder og foredrag med i den lokale kalender.
            </p>
          </div>
        </div>

        {/* Meddeler platform interaktiv klient */}
        <MeddelerPortalClient kommuneNavn={site.kommune} />

        {/* Sådan arbejder redaktionen / Vejledning */}
        <section
          style={{
            marginTop: "48px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-card)",
            padding: "32px 28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <ShieldCheck size={22} style={{ color: "var(--site-accent, #9E3D1B)" }} />
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "24px", margin: 0, color: "var(--ink)" }}>
              Sådan behandler redaktionen dit tip og din historie
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginTop: "16px" }}>
            <div>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--ink)", margin: "0 0 6px 0" }}>
                1. Kildebeskyttelse og anonymitet
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.5" }}>
                Du kan altid vælge at tippe os fortroligt. Redaktionen værner om kildebeskyttelse i henhold
                til medieansvarsloven og de presseetiske regler.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--ink)", margin: "0 0 6px 0" }}>
                2. Redaktionel vurdering
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.5" }}>
                Alle indberetninger gennemgås af redaktionen. Vi faktatjekker oplysninger, kontakter berørte
                parter og sikrer en sober, balanceret dækning af sagen.
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--ink)", margin: "0 0 6px 0" }}>
                3. Din personlige nøglekode
              </h3>
              <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.5" }}>
                Når du indsender, modtager du en unik adgangskode. Den giver dig adgang til dit eget
                meddelerpanel, hvor du kan følge status på din sag og tilføje flere oplysninger.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
