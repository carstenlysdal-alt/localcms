import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import { getCurrentSite } from "@/lib/site";
import { searchSiteArticles, getSiteNavigation } from "@/lib/site-queries";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ArticleCard } from "@/components/site/ArticleCard";
import { LoadMore } from "@/components/site/LoadMore";
import { Search } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/soeg", (site) => ({
    title: `Søg i ${site.navn}`,
    description: `Søg blandt alle lokale nyheder, baggrundsartikler og debatter i ${site.kommune}.`,
  }), { noindex: true });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = await getCurrentSite();
  const query = await searchParams;

  const q = typeof query.q === "string" ? query.q.trim() : "";
  const sektion = typeof query.sektion === "string" ? query.sektion : undefined;
  const omraade = typeof query.omraade === "string" ? query.omraade : undefined;
  const page = typeof query.side === "string" ? parseInt(query.side, 10) || 1 : 1;

  const [{ categories, areas }, searchResult] = await Promise.all([
    getSiteNavigation(site.id),
    q
      ? searchSiteArticles(site.id, q, {
          sectionSlug: sektion,
          areaSlug: omraade,
          page,
          take: 15,
        })
      : Promise.resolve({ totalCount: 0, artikler: [], page: 1, totalPages: 0 }),
  ]);

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container">
        <Breadcrumbs items={[{ label: "Forside", href: "/" }, { label: "Søg" }]} />

        <div className="site-page-header">
          <h1 className="site-page-title">Søg i arkivet</h1>
          <p className="site-page-desc">
            Find artikler, analyser, debatindlæg og interviews fra hele {site.kommune}.
          </p>
        </div>

        {/* Søgeformular */}
        <form action="/soeg" method="GET" className="site-search-form">
          <div className="site-search-input-wrap">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Søg på emne, ord, personer..."
              required
              className="site-search-input"
            />
            <button type="submit" className="site-search-submit">
              <Search size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: "6px" }} />
              Søg
            </button>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap" }}>
            <select
              name="sektion"
              defaultValue={sektion || ""}
              className="site-area-filter-select"
            >
              <option value="">Alle sektioner</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.navn}
                </option>
              ))}
            </select>

            <select
              name="omraade"
              defaultValue={omraade || ""}
              className="site-area-filter-select"
            >
              <option value="">Hele kommunen</option>
              {areas.map((a) => (
                <option key={a.id} value={a.slug || a.id}>
                  {a.navn}
                </option>
              ))}
            </select>
          </div>
        </form>

        {/* Resultater */}
        {q ? (
          <div>
            <div className="site-zone-heading" style={{ marginBottom: "20px" }}>
              <span>
                {searchResult.totalCount === 0
                  ? `Ingen resultater for "${q}"`
                  : `${searchResult.totalCount} resultat${searchResult.totalCount === 1 ? "" : "er"} for "${q}"`}
              </span>
            </div>

            {searchResult.artikler.length > 0 && (
              <div className="site-cards-grid-3">
                {searchResult.artikler.map((art) => (
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
                    headingLevel={3}
                  />
                ))}
              </div>
            )}

            <LoadMore
              currentPage={page}
              totalPages={searchResult.totalPages}
              totalCount={searchResult.totalCount}
            />
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-3)" }}>
            <p>Indtast et eller flere søgeord foroven for at finde artikler.</p>
          </div>
        )}
      </div>
    </div>
  );
}
