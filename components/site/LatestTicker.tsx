import Link from "next/link";
import { formatRelativeTime, type PublicArticleSummary } from "@/lib/site-queries";

type LatestTickerProps = {
  article: PublicArticleSummary | null;
};

export function LatestTicker({ article }: LatestTickerProps) {
  if (!article) return null;

  const relTime = formatRelativeTime(article.publiceretTid);

  return (
    <div className="site-ticker-container" aria-label="Seneste nyt ticker">
      <div className="site-ticker-inner">
        <div className="site-ticker-badge">
          <span className="site-ticker-dot" aria-hidden="true" />
          <span className="site-ticker-label">Seneste nyt</span>
        </div>

        <div className="site-ticker-content">
          <span className="site-ticker-time">{relTime}</span>
          <span className="site-ticker-sep">·</span>
          <Link href={article.href} className="site-ticker-link">
            {article.titel}
          </Link>
        </div>
      </div>
    </div>
  );
}
