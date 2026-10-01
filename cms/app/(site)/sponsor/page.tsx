import type { Metadata } from "next";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Handshake, Award, ShieldCheck, Check, FileText } from "lucide-react";
import { SponsorBriefForm } from "./SponsorBriefForm";

import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Sponsor & Erhvervspartnerskaber — ${site.navn}`,
    description: `Styrk din lokale synlighed og fortæl din virksomheds historie med gennemsigtigt, troværdigt partnerindhold på ${site.navn}.`,
  };
}

export default async function SponsorPortalPage() {
  const site = await getCurrentSite();

  return (
    <div className="site-page-container" style={{ padding: "28px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "800px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Bliv en del af journalistikken", href: "/bliv-en-del-af-journalistikken" },
            { label: "Sponsor & Erhverv" },
          ]}
        />

        <div style={{ marginBottom: "16px" }}>
          <Link
            href="/bliv-en-del-af-journalistikken?spor=erhverv"
            style={{
              fontSize: "13px",
              color: "var(--site-accent)",
              fontWeight: "600",
              textDecoration: "none",
            }}
          >
            ← En del af &quot;Bliv en del af journalistikken&quot;
          </Link>
        </div>

        <header className="site-page-header" style={{ marginBottom: "32px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#ecfdf5", color: "#065f46", padding: "4px 12px", borderRadius: "9999px", fontSize: "12px", fontWeight: "700", marginBottom: "12px" }}>
            <Handshake size={15} />
            <span>Erhverv & Partnere</span>
          </div>
          <h1 className="site-page-title" style={{ fontFamily: "var(--font-serif)", fontSize: "36px", margin: "0 0 12px 0", color: "var(--ink)" }}>
            Styrk din lokale forankring med troværdigt partnerindhold
          </h1>
          <p className="site-page-desc" style={{ fontSize: "17px", color: "var(--ink-2)", lineHeight: "1.5" }}>
            På {site.navn} tror vi på, at et stærkt lokalt erhvervsliv er forudsætningen for udvikling, arbejdspladser
            og lokal sammenhængskraft i {site.kommune}. Vi tilbyder gennemskuelige samarbejdsformater, hvor din virksomhed
            kan formidle vigtige budskaber, faglig ekspertise og lokale milepæle direkte til områdets borgere.
          </p>
        </header>

        {/* Principper for partnerindhold */}
        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "var(--radius-card)", padding: "20px 24px", marginBottom: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <ShieldCheck size={20} style={{ color: "#0f766e" }} />
            <h2 style={{ margin: 0, fontSize: "16px", fontFamily: "var(--font-display)", color: "#0f172a" }}>
              Vores presseetiske principper for sponsor- og partnerindhold
            </h2>
          </div>
          <p style={{ fontSize: "13.5px", color: "#334155", margin: "0 0 12px 0", lineHeight: "1.45" }}>
            For at bevare den fulde troværdighed over for læserne, følger alt kommercielt indhold klare regler:
          </p>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#475569", lineHeight: "1.5" }}>
            <li>Alt partnerindhold markeres synligt i toppen med <strong>◆ FINANSIERET AF [Virksomhedsnavn]</strong>.</li>
            <li>Partneren godkender fakta, tal og egne citater, mens den journalistiske tone forbliver læsevenlig og nøgtern.</li>
            <li>Partnerartikler integreres naturligt i sitets sektioner (Erhverv, Kultur, Bolig) og på forsiden.</li>
          </ul>
        </div>

        {/* Formater og Priser */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-card)", padding: "20px 24px", marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--site-accent)", letterSpacing: "0.05em", marginBottom: "4px" }}>
              Særlige opstartspriser 2026
            </div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--ink)", marginBottom: "4px" }}>
              Lokal synlighed til ca. 25 % af de store bymediers priser
            </div>
            <p style={{ margin: 0, fontSize: "13.5px", color: "var(--ink-2)", lineHeight: "1.45" }}>
              Event i kalenderen fra <strong>125 kr.</strong> · Sponsoreret artikel fra <strong>4.995 kr.</strong> inkl. Facebook-distribution · Profil i guiden <strong>249 kr./md.</strong>
            </p>
          </div>
          <Link
            href="/priser"
            className="site-header-btn-solid"
            style={{ textDecoration: "none", whiteSpace: "nowrap", padding: "10px 18px", fontSize: "13.5px" }}
          >
            Se hele prislisten & pakker →
          </Link>
        </div>

        {/* Formater */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "36px" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "20px", borderRadius: "var(--radius-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>
              <FileText size={18} style={{ color: "var(--site-accent)" }} />
              Sponsoreret artikel (4.995 kr.)
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              En dybdegående artikel om din virksomheds udvikling eller medarbejdere, inkl. fuld distribution på Facebook og nyhedsbrev.
            </p>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "20px", borderRadius: "var(--radius-card)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>
              <Award size={18} style={{ color: "var(--site-accent)" }} />
              Faste partnerskaber (fra 795 kr./md.)
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Helårligt samarbejde med fast synlighed på forsiden, native artikler, videoer og nyhedsbrevsomtale.
            </p>
          </div>
        </div>

        {/* Brief-formular */}
        <SponsorBriefForm siteNavn={site.navn} />
      </div>
    </div>
  );
}
