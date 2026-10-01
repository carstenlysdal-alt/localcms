import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { getAreasWithCounts } from "@/lib/site-frontpage";
import { MapPin } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/omraade", (site) => ({
    title: `Områder i ${site.kommune}`,
    description: `Find nyheder fra alle områder og byer i ${site.kommune}.`,
  }));
}

export default async function AreasIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = await getCurrentSite();
  const query = await searchParams;
  const areas = await getAreasWithCounts(site.id);

  // Fallback for områdevælgeren uden JavaScript (GET-formular): /omraade?valg=<slug>
  const valg = typeof query.valg === "string" ? query.valg : "";
  if (valg && areas.some((a) => a.slug === valg)) redirect(`/omraade/${valg}`);

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "880px" }}>
        <Breadcrumbs items={[{ label: "Forside", href: "/" }, { label: "Områder" }]} />

        <header className="site-page-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <MapPin size={28} style={{ color: "var(--site-accent)" }} />
            <h1 className="site-page-title" style={{ margin: 0 }}>
              Områder i {site.kommune}
            </h1>
          </div>
          <p className="site-page-desc" style={{ fontSize: "17px", lineHeight: 1.5 }}>
            Vælg dit nabolag og se de seneste historier derfra.
          </p>
        </header>

        {areas.length > 0 ? (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "24px 0",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "12px",
            }}
          >
            {areas.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/omraade/${a.slug}`}
                  style={{
                    display: "block",
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-card)",
                    padding: "16px",
                    textDecoration: "none",
                    color: "var(--ink)",
                  }}
                >
                  <strong style={{ fontFamily: "var(--font-display)", fontSize: "17px" }}>{a.navn}</strong>
                  <div style={{ fontSize: "13px", color: "var(--ink-3)", marginTop: "4px" }}>
                    {a.antal === 0 ? "Ingen artikler endnu" : a.antal === 1 ? "1 artikel" : `${a.antal} artikler`}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "var(--ink-2)" }}>Der er endnu ikke oprettet områder for {site.kommune}.</p>
        )}

        <p style={{ fontSize: "15px", color: "var(--ink-2)" }}>
          Mangler dit område? <Link href="/indsend" style={{ color: "var(--site-accent)", textDecoration: "underline" }}>Tip redaktionen</Link>.
        </p>
      </div>
    </div>
  );
}
