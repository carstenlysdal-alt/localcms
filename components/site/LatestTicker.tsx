import Link from "next/link";
import { formatRelativeTime, type PublicArticleSummary } from "@/lib/site-queries";

type LatestTickerProps = {
  article: PublicArticleSummary | null;
};

export function LatestTicker({ article }: LatestTickerProps) {
  if (!article) return null;

  const relTime = formatRelativeTime(article.publiceretTid);
  const pubDate = new Date(article.publiceretTid);
  const timeFormatted = pubDate.toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="site-ticker-bar" aria-label="Seneste nyt">
      <div className="site-container site-ticker-inner">
        <span className="site-ticker-badge">● SENESTE NYT</span>
        <span className="site-ticker-time">{relTime}</span>
        <Link href={article.href} className="site-ticker-headline">
          {article.titel}
        </Link>
        <span className="site-ticker-updated">Opdateret {timeFormatted}</span>
      </div>
    </div>
  );
}
