import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { getSiteNavigation } from "@/lib/site-queries";

export default async function SiteNotFound() {
  const site = await getCurrentSite();
  const { categories } = await getSiteNavigation(site.id);

  return (
    <div className="site-container">
      <div className="site-not-found-card">
        <div className="site-not-found-code">404</div>
        <h1 className="site-not-found-heading">Siden blev desværre ikke fundet</h1>
        <p className="site-not-found-text">
          Artiklen eller siden, du leder efter, kan være flyttet, omdøbt eller ikke længere tilgængelig.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "32px" }}>
          <Link href="/" className="site-pill is-active">
            Gå til forsiden
          </Link>
          <Link href="/soeg" className="site-pill">
            Søg i arkivet
          </Link>
        </div>

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "24px" }}>
          <span style={{ fontSize: "13px", fontWeight: "700", textTransform: "uppercase", color: "var(--ink-3)" }}>
            Populære sektioner:
          </span>
          <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginTop: "12px", flexWrap: "wrap" }}>
            {categories.map((c) => (
              <Link key={c.id} href={`/${c.slug}`} className="site-pill">
                {c.navn}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
