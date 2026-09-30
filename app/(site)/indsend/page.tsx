import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { SubmissionForm } from "@/components/site/SubmissionForm";
import { MessageSquarePlus, ShieldCheck, Mail } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Indsend tip eller debatindlæg — ${site.navn}`,
    description: `Har du en historie, et tip eller et debatindlæg fra ${site.kommune}? Indsend det direkte til redaktionen på ${site.navn}.`,
  };
}

export default async function SubmissionPage() {
  const site = await getCurrentSite();

  const areas = await db.geoTag.findMany({
    where: { instansId: site.id },
    orderBy: { navn: "asc" },
    select: { id: true, navn: true },
  });

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "840px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Indsend tip eller debatindlæg" },
          ]}
        />

        <header className="site-page-header" style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <MessageSquarePlus size={28} style={{ color: "var(--site-accent)" }} />
            <h1 className="site-page-title" style={{ margin: 0 }}>
              Tip os eller indsend dit indlæg
            </h1>
          </div>
          <p className="site-page-desc" style={{ fontSize: "17px", lineHeight: "1.5" }}>
            {site.navn} er et lokalt medie båret af nærvær og lokaldemokrati. Vi vil have stemmerne fra
            hele {site.kommune} frem i lyset. Ingen computere eller algoritmer publicerer noget
            automatisk – vores redaktion læser og vurderer alle henvendelser personligt.
          </p>
        </header>

        {/* Retningslinjer og principboks */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "16px 18px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "4px", fontSize: "14px" }}>
              <ShieldCheck size={18} style={{ color: "var(--site-accent)" }} />
              Presseetisk behandling
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Vi overholder de presseetiske regler og kildebeskyttelse. Vi kontakter dig altid, før noget bringes.
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "16px 18px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "4px", fontSize: "14px" }}>
              <Mail size={18} style={{ color: "var(--site-accent)" }} />
              Pressemeddelelser
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Virksomheder og foreninger kan også sende pressemeddelelser til{" "}
              <a href={`mailto:redaktion@${site.domaene}`} style={{ color: "var(--site-accent)", textDecoration: "underline" }}>
                redaktion@{site.domaene}
              </a>
              .
            </p>
          </div>
        </div>

        {/* Formularen */}
        <SubmissionForm
          areas={areas}
          siteNavn={site.navn}
          siteKommune={site.kommune}
        />

        {/* Hjælp / Info */}
        <div style={{ marginTop: "32px", textAlign: "center", fontSize: "14px", color: "var(--ink-3)" }}>
          Har du fortrolige oplysninger eller spørgsmål til redaktionen? Læs vores{" "}
          <Link href="/om-mediet/redaktionelle-principper" style={{ color: "var(--site-accent)", textDecoration: "underline" }}>
            redaktionelle principper
          </Link>{" "}
          eller kontakt chefredaktionen på{" "}
          <Link href="/om-mediet/kontakt" style={{ color: "var(--site-accent)", textDecoration: "underline" }}>
            kontaktsiden
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
