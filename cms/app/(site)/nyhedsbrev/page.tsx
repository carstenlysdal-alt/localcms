import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { NewsletterPageForm } from "@/components/site/NewsletterPageForm";
import { Mail, ShieldCheck, Zap, BellOff } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/nyhedsbrev", (site) => ({
    title: "Nyhedsbrev",
    description: `Modtag de vigtigste lokale nyheder fra ${site.kommune} direkte i din indbakke.`,
  }), { noindex: true });
}

export default async function NyhedsbrevPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = await getCurrentSite();
  const query = searchParams ? await searchParams : {};
  const status = typeof query.tilmelding === "string" ? query.tilmelding : null;
  const besked = typeof query.besked === "string" ? query.besked.slice(0, 160) : null;

  const areas = await db.geoTag.findMany({
    where: { instansId: site.id },
    orderBy: { navn: "asc" },
    select: { slug: true, navn: true },
  });

  const sections = await db.category.findMany({
    where: { instansId: site.id, parentId: null },
    orderBy: { sortering: "asc" },
    select: { slug: true, navn: true },
  });

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "800px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Nyhedsbrev" },
          ]}
        />

        <header className="site-page-header" style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <Mail size={28} style={{ color: "var(--site-accent)" }} />
            <h1 className="site-page-title" style={{ margin: 0 }}>
              Følg med i {site.navn}
            </h1>
          </div>
          <p className="site-page-desc" style={{ fontSize: "17px", lineHeight: "1.5" }}>
            Start dagen med et hurtigt og sobert overblik over de vigtigste lokale begivenheder,
            politiske beslutninger og menneskelige historier i {site.kommune}.
          </p>
        </header>

        {status === "ok" && (
          <div className="site-form-success-card" role="status" aria-live="polite" style={{ marginBottom: "24px" }}>
            <p style={{ margin: 0 }}>Tak for din tilmelding til {site.navn}s nyhedsbrev!</p>
          </div>
        )}
        {status === "fejl" && (
          <div className="site-form-alert-error" role="alert" style={{ marginBottom: "24px" }}>
            <span>{besked || "Tilmeldingen lykkedes ikke. Prøv igen."}</span>
          </div>
        )}

        {/* Fordele */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "16px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "4px", fontSize: "14px" }}>
              <ShieldCheck size={18} style={{ color: "var(--site-accent)" }} />
              Ingen overvågning
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Vi benytter hverken Google Analytics, Meta-pixels eller usynlige tracking-beacons. Dine data forbliver hos os.
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "16px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "4px", fontSize: "14px" }}>
              <Zap size={18} style={{ color: "var(--site-accent)" }} />
              Kort og skarpt
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Håndplukket af vores redaktion. Læses på 3 minutter over morgenkaffen uden clickbait eller pop-ups.
            </p>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              padding: "16px",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", marginBottom: "4px", fontSize: "14px" }}>
              <BellOff size={18} style={{ color: "var(--site-accent)" }} />
              1-klik afmelding
            </div>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-2)", lineHeight: "1.4" }}>
              Du kan altid framelde dig med ét enkelt klik nederst i hver eneste e-mail, hvis du ikke længere ønsker den.
            </p>
          </div>
        </div>

        {/* Tilmeldingsformular */}
        <NewsletterPageForm
          siteNavn={site.navn}
          siteKommune={site.kommune}
          areas={areas}
          sections={sections}
        />

        {/* Fortrolighedsnote */}
        <div style={{ marginTop: "32px", textAlign: "center", fontSize: "13px", color: "var(--ink-3)" }}>
          Vi passer godt på din adresse i overensstemmelse med vores{" "}
          <Link href="/om-mediet/privatliv" style={{ color: "var(--site-accent)", textDecoration: "underline" }}>
            privatlivspolitik
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
