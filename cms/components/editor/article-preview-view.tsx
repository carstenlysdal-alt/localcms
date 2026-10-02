import { MarkingBox } from "@/components/site/MarkingBox";
import { Byline } from "@/components/site/Byline";
import { SiteBlockRenderer, normalizeHtml } from "@/components/site/blocks/SiteBlockRenderer";
import type { Block } from "@/lib/blocks/schema";
import { creditLabel } from "@/lib/seo/jsonld";

export type ArticlePreviewData = {
  titel: string;
  manchet: string | null;
  indholdstype: string;
  marking: Record<string, unknown> | null;
  blocks: Block[];
  forfatter: { navn: string; slug?: string | null; bio?: string | null; profilbilledeUrl?: string | null } | null;
  cover: { url: string; altTekst: string | null; billedtekst: string | null; ophavsperson: string | null } | null;
  sektion: string;
  omraade: string;
  tags: string[];
  geo: string[];
  publiceretTid: Date | null;
  opdateretTid: Date;
};

/** Artikelvisning til kladde-preview. Bruger de offentlige sites blok-renderer, byline, mærkningsboks og klassenavne. */
export function ArticlePreviewView({ article }: { article: ArticlePreviewData }) {
  const linkRel =
    article.indholdstype === "Partner" || article.indholdstype === "Sponsoreret" || article.indholdstype === "PR"
      ? ["sponsored"]
      : article.indholdstype === "Brugerindsendt"
        ? ["ugc"]
        : undefined;
  return (
    <article className="site-article-page">
      <div className="site-container">
        <div className="site-article-layout">
          <div className="site-article-main">
            <div className="site-kicker">
              <span className="site-kicker-accent">{article.sektion.toUpperCase()}</span>
              <span className="site-kicker-dot">·</span>
              <span className="site-kicker-meta">{article.omraade.toUpperCase()}</span>
            </div>
            {article.indholdstype !== "Uafhængig" && <MarkingBox indholdstype={article.indholdstype} marking={article.marking} />}
            <h1 className="site-article-h1">{article.titel || "Uden titel"}</h1>
            {article.manchet && <div className="site-article-manchet" dangerouslySetInnerHTML={{ __html: normalizeHtml(article.manchet, { linkRel }) }} />}
            <div className="site-article-byline-row">
              <Byline forfatter={article.forfatter} publiceretTid={article.publiceretTid ?? new Date()} opdateretTid={article.opdateretTid} />
            </div>
            {article.cover && (
              <figure className="site-article-cover">
                <div className="site-article-cover-box">
                  {/* Kladde-preview: medie-værter er dynamiske, derfor almindeligt img. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="site-article-cover-img" src={article.cover.url} alt={article.cover.altTekst || article.titel} />
                </div>
                {(article.cover.billedtekst || article.cover.ophavsperson) && (
                  <figcaption className="site-article-caption">
                    {article.cover.billedtekst && <span>{article.cover.billedtekst}</span>}
                    {article.cover.ophavsperson && <span className="site-article-credit">{creditLabel(article.cover.ophavsperson)}</span>}
                  </figcaption>
                )}
              </figure>
            )}
            <SiteBlockRenderer blocks={article.blocks} linkRel={linkRel} />
            {(article.geo.length > 0 || article.tags.length > 0) && (
              <div className="site-article-tags">
                <span className="site-article-tags-label">Tags:</span>
                {article.geo.map((g) => <span key={g} className="site-article-tag-pill">{g}</span>)}
                {article.tags.map((t) => <span key={t} className="site-article-tag-pill">#{t}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
