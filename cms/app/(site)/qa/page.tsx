import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Inbox, CheckCircle, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import { QaPortalClient } from "./QaPortalClient";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Kilde-Q&A — ${site.navn}`,
    description: `Besvar spørgsmål som kilde eller indsend udtalelser til ${site.navn}. Hurtig, sikker og transparent kildebetjening uden login.`,
  };
}

export default async function QaPortalPage() {
  const site = await getCurrentSite();

  return (
    <div className="site-page-container" style={{ padding: "28px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "800px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Kilde-Q&A" },
          ]}
        />

        <header className="site-page-header" style={{ marginBottom: "32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#e0e7ff", color: "#3730a3", padding: "4px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: "700", marginBottom: "12px" }}>
            <Inbox size={15} />
            <span>Kildeportal & Udtalelser</span>
          </div>
          <h1 className="site-page-title" style={{ fontFamily: "var(--font-serif)", fontSize: "36px", margin: "0 0 12px 0", color: "var(--ink)" }}>
            Kilde-Q&A: Giv dit svar direkte til redaktionen
          </h1>
          <p className="site-page-desc" style={{ fontSize: "17px", color: "var(--ink-2)", lineHeight: "1.5" }}>
            {site.navn} bruger Kilde-Q&A til at give dig en rolig, præcis og direkte kanal til at besvare
            redaktionens spørgsmål eller fremsende en udtalelse på skrift. Intet login er påkrævet.
          </p>
        </header>

        {/* 3 værdier */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "36px" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "16px", borderRadius: "var(--radius-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "6px", color: "var(--ink)" }}>
              <ShieldCheck size={18} style={{ color: "var(--site-accent)" }} />
              Dine egne ord
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Du formulerer dine svar præcist, som du ønsker. Dine citater gengives loyalt og i rette sammenhæng.
            </p>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "16px", borderRadius: "var(--radius-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "6px", color: "var(--ink)" }}>
              <CheckCircle size={18} style={{ color: "var(--site-accent)" }} />
              Intet kodeord
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Dit personlige link eller kilde-token giver direkte adgang til din sag uden bøvl med oprettelse.
            </p>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "16px", borderRadius: "var(--radius-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "6px", color: "var(--ink)" }}>
              <HelpCircle size={18} style={{ color: "var(--site-accent)" }} />
              Direkte redaktionskontakt
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Når du trykker indsend, modtager den ansvarlige journalist dit svar med det samme i redaktionens indbakke.
            </p>
          </div>
        </div>

        {/* Klient-interaktion: Indtast kode eller opret ny kildeforespørgsel */}
        <QaPortalClient siteNavn={site.navn} />
      </div>
    </div>
  );
}
