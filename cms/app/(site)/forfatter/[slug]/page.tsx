import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { getCurrentSite } from "@/lib/site";
import { getAuthorArticles, formatDateDivider } from "@/lib/site-queries";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ArticleCard } from "@/components/site/ArticleCard";
import { DateDivider } from "@/components/site/DateDivider";
import { LoadMore } from "@/components/site/LoadMore";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const site = await getCurrentSite();
  const data = await getAuthorArticles(site.id, slug);
  if (!data) return {};

  return {
    title: `${data.author.navn} — Journalistprofil`,
    description: data.author.bio || `Artikler og dækning af ${data.author.navn} på ${site.navn}.`,
  };
}

export default async function AuthorPage({
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

  const data = await getAuthorArticles(site.id, slug, { page, take: 15 });
  if (!data) {
    notFound();
  }

  const { author, artikler, totalCount, totalPages } = data;

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
            { label: "Redaktionen", href: "/om-mediet" },
            { label: author.navn },
          ]}
        />

        <header className="site-author-header">
          {author.profilbilledeUrl && (
            <Image
              src={author.profilbilledeUrl}
              alt={author.navn}
              width={96}
              height={96}
              className="site-author-portrait-lg"
            />
          )}
          <div className="site-author-meta">
            <h1>{author.navn}</h1>
            {author.bio && <p className="site-author-bio">{author.bio}</p>}
          </div>
        </header>

        {artikler.length > 0 ? (
          <div className="site-chronological-list">
            <h2 className="site-zone-heading">Artikler af {author.navn} ({totalCount})</h2>
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
                        forfatter: { navn: author.navn, portraetUrl: author.profilbilledeUrl },
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
            Ingen artikler publiceret af denne forfatter endnu.
          </p>
        )}
      </div>
    </div>
  );
}
