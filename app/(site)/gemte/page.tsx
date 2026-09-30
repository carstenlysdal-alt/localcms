import type { Metadata } from "next";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { SavedArticlesClient } from "@/components/site/SavedArticlesClient";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Gemte artikler — ${site.navn}`,
    description: `Dine gemte artikler på ${site.navn}. Læs offline og genfind dine yndlingshistorier.`,
  };
}

export default async function GemteArtiklerPage() {
  const site = await getCurrentSite();

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "760px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Gemte artikler" },
          ]}
        />
        <SavedArticlesClient siteNavn={site.navn} />
      </div>
    </div>
  );
}
