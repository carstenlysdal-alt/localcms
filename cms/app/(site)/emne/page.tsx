import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { getTopicsOverview } from "@/lib/site-frontpage";
import { Tag } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/emne", (site) => ({
    title: `Emner i ${site.kommune}`,
    description: `Find artikler om de emner, der fylder mest i ${site.kommune}.`,
  }));
}

export default async function TopicsIndexPage() {
  const site = await getCurrentSite();
  const { tags, undersektioner } = await getTopicsOverview(site.id);

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "880px" }}>
        <Breadcrumbs items={[{ label: "Forside", href: "/" }, { label: "Emner" }]} />

        <header className="site-page-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <Tag size={28} style={{ color: "var(--site-accent)" }} />
            <h1 className="site-page-title" style={{ margin: 0 }}>Emner</h1>
          </div>
          <p className="site-page-desc" style={{ fontSize: "17px", lineHeight: 1.5 }}>
            Gå på opdagelse i de emner, vi følger i {site.kommune}.
          </p>
        </header>

        {undersektioner.length > 0 && (
          <section style={{ margin: "24px 0" }}>
            <h2 className="site-block-heading">Nyhedsemner</h2>
            <p style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {undersektioner.map((u) => (
                <Link key={u.id} href={`/nyheder/${u.slug}`} className="site-pill">
                  {u.navn}
                </Link>
              ))}
            </p>
          </section>
        )}

        {tags.length > 0 && (
          <section style={{ margin: "24px 0" }}>
            <h2 className="site-block-heading">Stikord</h2>
            <p style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {tags.map((t) => (
                <Link key={t.id} href={`/emne/${t.slug}`} className="site-pill">
                  #{t.navn} ({t.antal})
                </Link>
              ))}
            </p>
          </section>
        )}

        {tags.length === 0 && undersektioner.length === 0 && (
          <p style={{ color: "var(--ink-2)" }}>Der er endnu ingen emner for {site.kommune}.</p>
        )}

        <p style={{ fontSize: "15px" }}>
          <Link href="/omraade" style={{ color: "var(--site-accent)", textDecoration: "underline" }}>Se også områder</Link>
        </p>
      </div>
    </div>
  );
}
