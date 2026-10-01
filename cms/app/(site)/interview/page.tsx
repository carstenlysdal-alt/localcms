import type { Metadata } from "next";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Mic, Sparkles, MessageCircle, Clock, Volume2, Shield } from "lucide-react";
import { InterviewPortalClient } from "./InterviewPortalClient";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `AI Kildeinterview — ${site.navn}`,
    description: `Giv et guidet interview til ${site.navn} via tale eller tekst. Fleksibel journalistisk kildebetjening.`,
  };
}

export default async function InterviewPortalPage() {
  const site = await getCurrentSite();

  return (
    <div className="site-page-container" style={{ padding: "28px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "800px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "AI Kildeinterview" },
          ]}
        />

        <header className="site-page-header" style={{ marginBottom: "32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#ede9fe", color: "#5b21b6", padding: "4px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: "700", marginBottom: "12px" }}>
            <Mic size={15} />
            <span>Guidet kildeinterview</span>
          </div>
          <h1 className="site-page-title" style={{ fontFamily: "var(--font-serif)", fontSize: "36px", margin: "0 0 12px 0", color: "var(--ink)" }}>
            AI Kildeinterview: Fortæl din historie i dit eget tempo
          </h1>
          <p className="site-page-desc" style={{ fontSize: "17px", color: "var(--ink-2)", lineHeight: "1.5" }}>
            Vores kildeinterview er udviklet til travle kilder, foreningsfolk og lokale fagpersoner.
            Gennemfør interviewet når du har tid — svar med din egen stemme eller på skrift.
          </p>
        </header>

        {/* 3 fordele */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "36px" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "16px", borderRadius: "var(--radius-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "6px", color: "var(--ink)" }}>
              <Volume2 size={18} style={{ color: "#7c3aed" }} />
              Tale eller tekst
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Indtal dine svar direkte i mikrofonen, eller tast dem ind. Systemet transskriberer automatisk.
            </p>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "16px", borderRadius: "var(--radius-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "6px", color: "var(--ink)" }}>
              <Sparkles size={18} style={{ color: "#7c3aed" }} />
              Intelligente opfølgninger
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Interviewet stiller relevante opfølgende spørgsmål til dine pointer for at få alle nuancer med.
            </p>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "16px", borderRadius: "var(--radius-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "6px", color: "var(--ink)" }}>
              <Shield size={18} style={{ color: "#7c3aed" }} />
              Kildebeskyttelse & citatret
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Redaktionen gennemgår altid materialet personligt. Intet publiceres uden redaktionel godkendelse.
            </p>
          </div>
        </div>

        <InterviewPortalClient siteNavn={site.navn} />
      </div>
    </div>
  );
}
