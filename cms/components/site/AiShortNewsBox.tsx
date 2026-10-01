import Link from "next/link";
import { type PublicArticleSummary } from "@/lib/site-queries";

interface AiShortNewsBoxProps {
  artikler: PublicArticleSummary[];
}

export function AiShortNewsBox({ artikler }: AiShortNewsBoxProps) {
  // Vis de første 3-4 kort nyt artikler
  const items = artikler.slice(0, 4);

  return (
    <div className="b site-ai-short-box">
      <div className="site-ai-short-header">
        <span className="site-ai-short-title">KORT NYT</span>
        <span className="site-ai-short-badge">✦ AI-ASSISTERET</span>
      </div>

      <div className="site-ai-short-list">
        {items.length > 0 ? (
          items.map((art, idx) => {
            const date = new Date(art.publiceretTid);
            const timeStr = date.toLocaleTimeString("da-DK", {
              hour: "2-digit",
              minute: "2-digit",
            });
            const isLast = idx === items.length - 1;

            return (
              <div
                key={art.id}
                className={`site-ai-short-item ${isLast ? "is-last" : ""}`}
              >
                <div className="site-ai-short-line">
                  <span className="site-ai-short-time">{timeStr}</span>
                  <Link href={art.href} className="site-ai-short-link">
                    {art.titel}
                  </Link>
                </div>
                <div className="site-ai-short-source">
                  Kilde: referat / pressemeddelelse
                </div>
              </div>
            );
          })
        ) : (
          <div className="site-ai-short-item is-last">
            <div className="site-ai-short-line">
              <span className="site-ai-short-time">Lige nu</span>
              <span>Redaktionen opdaterer løbende med korte nyheder fra lokalområdet.</span>
            </div>
          </div>
        )}
      </div>

      <div className="site-ai-short-footer">
        <span>Godkendt af redaktionen</span>
        <span className="site-ai-short-sep">·</span>
        <Link href="/om-mediet" className="site-ai-short-about-link">
          Hvordan vi bruger AI →
        </Link>
      </div>
    </div>
  );
}
