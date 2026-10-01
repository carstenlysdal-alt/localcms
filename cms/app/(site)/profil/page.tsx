import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import { getCurrentSite } from "@/lib/site";
import { db } from "@/lib/db";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { BrugerprofilClient } from "@/components/site/BrugerprofilClient";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/profil", (site) => ({
    title: "Min brugerprofil",
    description: `Administrér dine præferencer, fulgte emner, nyhedsbreve og gemte artikler på ${site.navn}.`,
  }), { noindex: true });
}

export default async function BrugerprofilPage() {
  const site = await getCurrentSite();

  // Hent områder / bydele tilknyttet dette site
  const geoTags = await db.geoTag.findMany({
    where: { instansId: site.id },
    select: { id: true, navn: true },
    orderBy: { navn: "asc" },
  });

  return (
    <div className="site-page-container" style={{ padding: "28px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "800px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Min profil" },
          ]}
        />

        <BrugerprofilClient
          siteNavn={site.navn}
          kommune={site.kommune}
          areas={geoTags}
        />
      </div>
    </div>
  );
}
