import Link from "next/link";
import Image from "next/image";
import { type PublicArticleSummary } from "@/lib/site-queries";

interface CitizenStoriesBoxProps {
  artikler: PublicArticleSummary[];
}

export function CitizenStoriesBox({ artikler }: CitizenStoriesBoxProps) {
  const items = artikler.slice(0, 3);

  return (
    <div className="b site-citizen-box">
      <div className="site-citizen-header">
        <span className="site-citizen-title">FRA BORGERNE</span>
        <span className="site-citizen-badge">▣ INDSENDT</span>
      </div>

      <div className="site-citizen-list">
        {items.length > 0 ? (
          items.map((art) => {
            const sender =
              (art.marking?.afsender as string | undefined) ||
              art.forfatter?.navn ||
              "Lokal borger";

            return (
              <div key={art.id} className="site-citizen-item">
                <div className="site-citizen-thumb">
                  {art.coverMedia?.url ? (
                    <Image
                      src={art.coverMedia.url}
                      alt={art.coverMedia.altTekst || art.titel}
                      width={54}
                      height={54}
                      className="site-citizen-thumb-img"
                    />
                  ) : (
                    <div className="site-citizen-thumb-placeholder" />
                  )}
                </div>
                <div className="site-citizen-info">
                  <Link href={art.href} className="site-citizen-item-link">
                    <h4 className="site-citizen-item-title">{art.titel}</h4>
                  </Link>
                  <div className="site-citizen-item-byline">
                    Indsendt af {sender}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="site-citizen-item">
            <div className="site-citizen-thumb">
              <div className="site-citizen-thumb-placeholder" />
            </div>
            <div className="site-citizen-info">
              <h4 className="site-citizen-item-title">
                Del din forenings nyheder, lokale historier eller fotos
              </h4>
              <div className="site-citizen-item-byline">
                Åbent for alle i lokalsamfundet
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="site-citizen-footer">
        <Link href="/indsend" className="site-citizen-cta-link">
          Del din historie →
        </Link>
      </div>
    </div>
  );
}
