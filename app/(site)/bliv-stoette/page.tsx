import type { Metadata } from "next";
import { getCurrentSite } from "@/lib/site";
import { SupportMembershipClient } from "@/components/site/SupportMembershipClient";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Støt lokalt — ${site.navn}`,
    description: `Uafhængig lokaljournalistik i ${site.kommune}. Bliv medlem og vær med til at sikre kritisk og konstruktiv journalistik.`,
  };
}

export default async function SupportPage() {
  const site = await getCurrentSite();

  return (
    <main className="site-page-container support-page-wrapper">
      <div className="site-container">
        <SupportMembershipClient
          siteNavn={site.navn}
          kommuneNavn={site.kommune}
        />
      </div>
    </main>
  );
}
