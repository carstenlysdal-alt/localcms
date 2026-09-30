import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { PartnerReviewClient } from "./PartnerReviewClient";
import { Handshake, ShieldCheck, Clock, Building } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const brief = await db.sponsorBrief.findUnique({ where: { token } });
  return {
    title: brief ? `Partnerpanel: ${brief.partnerNavn}` : "Partnerpanel",
    robots: { index: false, follow: false },
  };
}

export default async function PartnerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const site = await getCurrentSite();

  const brief = await db.sponsorBrief.findUnique({
    where: { token },
    include: {
      article: {
        select: {
          id: true,
          titel: true,
          manchet: true,
          slug: true,
          status: true,
        },
      },
    },
  });

  if (!brief) {
    return (
      <div className="site-page-container" style={{ padding: "48px 0" }}>
        <div className="site-container" style={{ maxWidth: "600px", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "28px" }}>Ugyldigt partnerlink</h1>
          <p style={{ color: "var(--ink-2)", marginTop: "8px" }}>
            Vi kunne ikke finde briefet med denne kode. Kontakt redaktionen, hvis du mener, der er sket en fejl.
          </p>
        </div>
      </div>
    );
  }

  const briefData = (brief.briefData as Record<string, string>) || {};
  const quotesList = Array.isArray(brief.citater) ? (brief.citater as string[]) : [];

  return (
    <div className="site-page-container" style={{ padding: "28px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "780px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Partnerportal", href: "/sponsor" },
            { label: brief.partnerNavn },
          ]}
        />

        {/* Header */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-card)",
            padding: "28px",
            marginBottom: "28px",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#065f46", marginBottom: "8px" }}>
            <Handshake size={18} />
            <span style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Partner- & Briefpanel
            </span>
            <span
              style={{
                marginLeft: "auto",
                background: brief.status === "Godkendt" ? "#dcfce7" : "#ecfdf5",
                color: brief.status === "Godkendt" ? "#166534" : "#065f46",
                padding: "2px 10px",
                borderRadius: "9999px",
                fontSize: "11px",
                fontWeight: "700",
              }}
            >
              Status: {brief.status}
            </span>
          </div>

          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "30px", margin: "0 0 12px 0", color: "var(--ink)" }}>
            {brief.partnerNavn}
          </h1>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", paddingTop: "12px", borderTop: "1px solid var(--line)", fontSize: "13px", color: "var(--ink-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Building size={14} />
              <span>Format: <strong>{brief.format}</strong></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Clock size={14} />
              <span>Kontakt: <strong>{brief.kontaktNavn}</strong> ({brief.kontaktEmail})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
              <ShieldCheck size={14} />
              <span>Mærket partnerindhold · {site.navn}</span>
            </div>
          </div>
        </div>

        {/* Interaktiv klient */}
        <PartnerReviewClient
          token={token}
          brief={brief}
          briefData={briefData}
          quotes={quotesList}
          linkedArticle={brief.article}
        />
      </div>
    </div>
  );
}
