import { ArticleCard } from "./ArticleCard";
import type { PublicArticleSummary } from "@/lib/site-queries";
import { Zap } from "lucide-react";

type ShortNewsListProps = {
  artikler: PublicArticleSummary[];
  titel?: string;
};

export function ShortNewsList({ artikler, titel = "Kort nyt" }: ShortNewsListProps) {
  if (!artikler || artikler.length === 0) return null;

  return (
    <section className="site-short-news-section" aria-labelledby="short-news-heading">
      <div className="site-short-news-header">
        <Zap size={18} className="site-short-news-icon" />
        <h2 id="short-news-heading" className="site-short-news-title">
          {titel}
        </h2>
      </div>

      <div className="site-short-news-list">
        {artikler.map((art) => (
          <div key={art.id} className="site-short-news-item">
            <ArticleCard
              variant="tekst"
              article={{
                titel: art.titel,
                href: art.href,
                sektion: art.sektion.navn,
                undersektion: art.undersektion?.navn,
                omraade: art.omraade?.navn,
                publiceret: art.publiceretTid,
                indholdstype: art.indholdstype,
                sponsor: art.marking?.sponsor as string | undefined,
                afsender: art.marking?.afsender as string | undefined,
                godkendtAf: art.marking?.godkendtAf as string | undefined,
                breaking: art.breaking,
              }}
              headingLevel={3}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
