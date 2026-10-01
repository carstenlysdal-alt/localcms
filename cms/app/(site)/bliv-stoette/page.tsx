import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import { getCurrentSite } from "@/lib/site";
import { SupportMembershipClient } from "@/components/site/SupportMembershipClient";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/bliv-stoette", (site) => ({
    title: `Støt lokaljournalistik i ${site.kommune}`,
    description: `Uafhængig lokaljournalistik i ${site.kommune}. Bliv medlem og vær med til at sikre kritisk og konstruktiv journalistik.`,
  }));
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
