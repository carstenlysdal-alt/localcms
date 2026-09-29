import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentSite } from "@/lib/site";
import { getAreaArticles, formatDateDivider } from "@/lib/site-queries";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ArticleCard } from "@/components/site/ArticleCard";
import { DateDivider } from "@/components/site/DateDivider";
import { LoadMore } from "@/components/site/LoadMore";
import { MapPin } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getCurrentSite();
  const data = await getAreaArticles(site.id, slug);
  if (!data) return {};

  return {
    title: `${data.area.navn} — Nyheder og historier`,
    description: `Seneste lokale nyheder, begivenheder og historier fra ${data.area.navn}.`,
  };
}

export default async function AreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const site = await getCurrentSite();
  const page = typeof query.side === "string" ? parseInt(query.side, 10) || 1 : 1;

  const data = await getAreaArticles(site.id, slug, { page, take: 15 });
  if (!data) {
    notFound();
  }

  const { area, artikler, totalCount, totalPages } = data;

  // Gruppér efter dato
  const dateGroups: Array<{ label: string; artikler: typeof artikler }> = [];
  artikler.forEach((art) => {
    const dividerLabel = formatDateDivider(art.publiceretTid);
    const existing = dateGroups.find((g) => g.label === dividerLabel);
    if (existing) {
      existing.artikler.push(art);
    } else {
      dateGroups.push({ label: dividerLabel, artikler: [art] });
    }
  });

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container">
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Områder" },
            { label: area.navn },
          ]}
        />

        <div className="site-page-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <MapPin size={26} style={{ color: "var(--site-accent)" }} />
            <h1 className="site-page-title" style={{ margin: 0 }}>
              {area.navn}
            </h1>
          </div>
          <p className="site-page-desc">
            Dækning af lokalsamfundet, erhverv, kultur og borgere i {area.navn} og omegn.
          </p>
        </div>

        {artikler.length > 0 ? (
          <div className="site-chronological-list">
            {dateGroups.map((group) => (
              <div key={group.label} className="site-date-group">
                <DateDivider label={group.label} />
                <div className="site-cards-grid-3">
                  {group.artikler.map((art) => (
                    <ArticleCard
                      key={art.id}
                      variant="standard"
                      article={{
                        titel: art.titel,
                        href: art.href,
                        sektion: art.sektion.navn,
                        undersektion: art.undersektion?.navn,
                        omraade: art.omraade?.navn,
                        cover: art.coverMedia
                          ? {
                              url: art.coverMedia.url,
                              alt: art.coverMedia.altTekst || art.titel,
                            }
                          : null,
                        forfatter: art.forfatter,
                        publiceret: art.publiceretTid,
                        indholdstype: art.indholdstype,
                        sponsor: art.marking?.sponsor as string | undefined,
                        afsender: art.marking?.afsender as string | undefined,
                        godkendtAf: art.marking?.godkendtAf as string | undefined,
                        breaking: art.breaking,
                      }}
                      headingLevel={2}
                    />
                  ))}
                </div>
              </div>
            ))}

            <LoadMore
              currentPage={page}
              totalPages={totalPages}
              totalCount={totalCount}
            />
          </div>
        ) : (
          <p style={{ color: "var(--ink-2)", fontStyle: "italic", padding: "40px 0" }}>
            Der er endnu ingen artikler for {area.navn}.
          </p>
        )}
      </div>
    </div>
  );
}
