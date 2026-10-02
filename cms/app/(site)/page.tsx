import type { Metadata } from "next";
import { buildPageMetadata, analyzeQuery } from "@/lib/seo/meta";
import { getCurrentSite, getNetworkLinks } from "@/lib/site";
import { getSiteNavigation } from "@/lib/site-queries";
import { getActivePartners } from "@/lib/site-frontpage";
import { resolveFrontpageForRender } from "@/lib/frontpage/service";
import { BlivEnDelAfJournalistikkenBlock } from "@/components/site/BlivEnDelAfJournalistikkenBlock";
import { TopicFilterBar } from "@/components/site/TopicFilterBar";
import { BeaconPartners } from "@/components/site/BeaconPartners";
import { FrontpageRender } from "@/components/site/frontpage/FrontpageRender";
import { buildRenderContext } from "@/components/site/frontpage/data";
import { MapPin } from "lucide-react";

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const site = await getCurrentSite();
  const { hasFilter } = analyzeQuery(searchParams ? await searchParams : {});
  return buildPageMetadata({
    site,
    path: "/",
    title: `${site.navn} – lokale nyheder fra ${site.kommune}`,
    titleAbsolute: true,
    description: `${site.tagline}. Læs de seneste lokale nyheder, sport, erhverv, kultur og debat fra ${site.kommune} og omegn.`,
    hasFilter,
  });
}

/**
 * Modulær forside (T11/T12): layoutet er en gemt rækkefølge af moduler; hvert modul viser sine tildelte artikler.
 * resolveFrontpageForRender kaster aldrig (godkendt snapshot -> deterministisk -> seneste nyt). Hvilken kilde der
 * blev brugt vises KUN i editoren, aldrig for besøgende.
 */
export default async function Frontpage() {
  const site = await getCurrentSite();
  const [{ resolved }, { categories }, networkLinks, partners] = await Promise.all([
    resolveFrontpageForRender(site.id),
    getSiteNavigation(site.id),
    getNetworkLinks(),
    getActivePartners(site.id).catch(() => [] as string[]),
  ]);

  const ctx = await buildRenderContext({ id: site.id, navn: site.navn, kommune: site.kommune }, resolved.modules, resolved.assignments);

  const sectionPaths = categories.flatMap((c) => [`/${c.slug}`, ...c.children.map((sub) => `/${c.slug}/${sub.slug}`)]);
  const today = new Intl.DateTimeFormat("da-DK", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Copenhagen" }).format(new Date());
  const dateText = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <FrontpageRender
      ctx={ctx}
      before={
        <>
          <div className="site-mobile-edition-bar site-mobile-only">
            <div className="site-mobile-edition-city">
              <MapPin size={13} style={{ color: "var(--site-accent)" }} aria-hidden="true" />
              <span>{site.kommune}</span>
            </div>
            <div className="site-mobile-edition-date">
              <span>{dateText}</span>
            </div>
          </div>
          <TopicFilterBar currentCity={site.kommune} networkSites={networkLinks} sectionPaths={sectionPaths} sections={categories.map((c) => ({ navn: c.navn, slug: c.slug }))} />
        </>
      }
      after={
        <>
          <BlivEnDelAfJournalistikkenBlock siteNavn={site.navn} kommuneNavn={site.kommune} />
          <BeaconPartners kommuneNavn={site.kommune} partners={partners} />
        </>
      }
    />
  );
}
