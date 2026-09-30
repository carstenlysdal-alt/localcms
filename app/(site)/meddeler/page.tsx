import type { Metadata } from "next";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Radio, Users, Trophy, Flame, Landmark, MapPin } from "lucide-react";
import { MeddelerPortalClient } from "./MeddelerPortalClient";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Meddeler-netværket — ${site.navn}`,
    description: `Bliv lokal meddeler for ${site.navn}. Rapporter fra din sportsklub, forening, beredskab eller lokalområde.`,
  };
}

export default async function MeddelerPortalPage() {
  const site = await getCurrentSite();

  return (
    <div className="site-page-container" style={{ padding: "28px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "800px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Meddeler-netværket" },
          ]}
        />

        <header className="site-page-header" style={{ marginBottom: "32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#fef3c7", color: "#92400e", padding: "4px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: "700", marginBottom: "12px" }}>
            <Radio size={15} />
            <span>Lokalt kildenetværk</span>
          </div>
          <h1 className="site-page-title" style={{ fontFamily: "var(--font-serif)", fontSize: "36px", margin: "0 0 12px 0", color: "var(--ink)" }}>
            Bliv lokal meddeler i {site.kommune}
          </h1>
          <p className="site-page-desc" style={{ fontSize: "17px", color: "var(--ink-2)", lineHeight: "1.5" }}>
            Ingen kender lokalsamfundet bedre end dem, der selv er til stede. Vores meddeler-netværk samler
            ildsjæle, trænere, foreningssekretærer, bylaug og beredskabskilder, der hurtigt og enkelt kan
            tippe og berette direkte til redaktionen.
          </p>
        </header>

        {/* Kategorier for meddelere */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "36px" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "18px", borderRadius: "var(--radius-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "6px", color: "var(--ink)" }}>
              <Trophy size={18} style={{ color: "#d97706" }} />
              Sport & Foreningsliv
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Kampreferater, oprykninger, stævner og generalforsamlinger fra lokale klubber.
            </p>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "18px", borderRadius: "var(--radius-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "6px", color: "var(--ink)" }}>
              <Flame size={18} style={{ color: "#d97706" }} />
              Beredskab & Trafik
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Uheld, afspærringer, vejrforhold og akutte observationer fra vejene og kysten.
            </p>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "18px", borderRadius: "var(--radius-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "6px", color: "var(--ink)" }}>
              <Landmark size={18} style={{ color: "#d97706" }} />
              Landsbyer & Bylaug
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Lokale initiativer, lokalrådsmøder, vejfester og mærkesager fra oplandets byer.
            </p>
          </div>
        </div>

        <MeddelerPortalClient kommuneNavn={site.kommune} />
      </div>
    </div>
  );
}
