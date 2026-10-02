import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { resolveOwnerConfig } from "@/lib/owner-config";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { Mail, MapPin, Send, MessageSquare, AlertCircle } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/om-mediet/kontakt", (site) => ({
    title: "Kontakt redaktionen",
    description: `Kontakt ${site.navn}, send en pressemeddelelse eller indsend et anonymt eller åbent tip til redaktionen.`,
  }));
}

export default async function ContactPage() {
  const site = await getCurrentSite();
  const owner = resolveOwnerConfig(site);

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "800px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Om mediet", href: "/om-mediet" },
            { label: "Kontakt" },
          ]}
        />

        <header className="site-page-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <Mail size={28} style={{ color: "var(--site-accent)" }} />
            <h1 className="site-page-title" style={{ margin: 0 }}>
              Kontakt {site.navn}
            </h1>
          </div>
          <p className="site-page-desc" style={{ fontSize: "18px", lineHeight: "1.5" }}>
            Har du et tip, en pressemeddelelse, et debatindlæg eller spørgsmål til vores dækning?
            Vi hører meget gerne fra dig.
          </p>
        </header>

        {/* Tip-opfordring boks */}
        <div
          style={{
            background: "var(--site-accent-soft)",
            borderLeft: "4px solid var(--site-accent)",
            padding: "24px",
            borderRadius: "0 var(--radius-card) var(--radius-card) 0",
            margin: "24px 0 40px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Send size={20} style={{ color: "var(--site-accent)" }} />
            <strong style={{ fontFamily: "var(--font-display)", fontSize: "17px", color: "var(--ink)" }}>
              Tip redaktionen
            </strong>
          </div>
          <p style={{ margin: "0 0 16px 0", fontSize: "15px", color: "var(--ink-2)", lineHeight: "1.45" }}>
            Oplever du noget usædvanligt i {site.kommune}? Har du dokumentation for en vigtig sag,
            eller vil du gøre opmærksom på en god lokal historie? Du kan kontakte os direkte eller
            anvende vores indsendelsesformular.
          </p>
          <Link href="/indsend" className="site-pill is-active" style={{ display: "inline-block" }}>
            Gå til indsendelsesformularen →
          </Link>
        </div>

        {/* Kontaktinformationer */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
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
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <Mail size={18} style={{ color: "var(--site-accent)" }} />
              <strong style={{ fontFamily: "var(--font-display)", fontSize: "16px" }}>
                Redaktionens e-mail
              </strong>
            </div>
            <p style={{ margin: "0 0 4px 0", fontSize: "15px" }}>
              <a
                href={`mailto:redaktion@${site.domaene}`}
                style={{ color: "var(--site-accent)", fontWeight: "600", textDecoration: "underline" }}
              >
                redaktion@{site.domaene}
              </a>
            </p>
            <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>
              Pressemeddelelser, tips og henvendelser
            </span>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "20px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <MessageSquare size={18} style={{ color: "var(--site-accent)" }} />
              <strong style={{ fontFamily: "var(--font-display)", fontSize: "16px" }}>
                Debat og læserbreve
              </strong>
            </div>
            <p style={{ margin: "0 0 4px 0", fontSize: "15px" }}>
              <a
                href={`mailto:debat@${site.domaene}`}
                style={{ color: "var(--site-accent)", fontWeight: "600", textDecoration: "underline" }}
              >
                debat@{site.domaene}
              </a>
            </p>
            <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>
              Maks. 3.000 tegn. Vedhæft foto og titel.
            </span>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "20px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <AlertCircle size={18} style={{ color: "var(--site-accent)" }} />
              <strong style={{ fontFamily: "var(--font-display)", fontSize: "16px" }}>
                Rettelser
              </strong>
            </div>
            <p style={{ margin: "0 0 4px 0", fontSize: "15px" }}>
              <Link
                href="/om-mediet/rettelser"
                style={{ color: "var(--site-accent)", fontWeight: "600", textDecoration: "underline" }}
              >
                Anmeld en fejl
              </Link>
            </p>
            <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>
              Vi retter faktuelle fejl hurtigt og transparent
            </span>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "20px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <MapPin size={18} style={{ color: "var(--site-accent)" }} />
              <strong style={{ fontFamily: "var(--font-display)", fontSize: "16px" }}>
                Adresse & Udgiver
              </strong>
            </div>
            <p style={{ margin: "0 0 4px 0", fontSize: "14px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              {site.navn} Udgiverselskab<br />
              {site.kommune}, Danmark
            </p>
            {owner.ansvarshavendeRedaktoer && (
              <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>
                Ansvarshavende redaktør: {owner.ansvarshavendeRedaktoer}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
