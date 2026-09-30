import Link from "next/link";
import Image from "next/image";
import { formatRelativeTime } from "@/lib/site-queries";
import { ContentLabel } from "./ContentLabel";

export type ArticleCardData = {
  titel: string;
  manchet?: string;
  href: string;
  sektion: string;
  undersektion?: string;
  omraade?: string;
  cover?: { url: string; alt: string } | null;
  forfatter?: { navn: string; portraetUrl?: string | null } | null;
  publiceret: Date | string;
  indholdstype: "Uafhængig" | "Partner" | "Sponsoreret" | "Brugerindsendt" | "AI-assisteret" | "PR";
  sponsor?: string;
  afsender?: string;
  godkendtAf?: string;
  debatLabel?: "Leder" | "Kommentar" | "Læserbrev" | string;
  breaking?: boolean;
};

type ArticleCardProps = {
  variant: "hoved" | "standard" | "kompakt" | "tekst";
  article: ArticleCardData;
  headingLevel?: 2 | 3 | 4;
  priority?: boolean;
};

export function ArticleCard({
  variant,
  article,
  headingLevel = 3,
  priority = false,
}: ArticleCardProps) {
  const {
    titel,
    manchet,
    href,
    sektion,
    undersektion,
    omraade,
    cover,
    forfatter,
    publiceret,
    indholdstype,
    sponsor,
    afsender,
    godkendtAf,
    debatLabel,
    breaking,
  } = article;

  const pubDate = typeof publiceret === "string" ? new Date(publiceret) : publiceret;
  const isoTime = pubDate.toISOString();
  const relTime = formatRelativeTime(pubDate);

  // Kategori-label
  let categoryMeta = "";
  if (variant === "hoved" || variant === "standard") {
    const parts = [sektion, undersektion, omraade].filter(Boolean);
    categoryMeta = parts.join(" · ").toUpperCase();
  } else if (variant === "kompakt") {
    const parts = [undersektion || sektion, omraade].filter(Boolean);
    categoryMeta = parts.join(" · ").toUpperCase();
  }

  // Mærkningsklasse
  const markingClass =
    indholdstype === "Sponsoreret"
      ? "site-card-ad"
      : indholdstype === "Partner"
      ? "site-card-partner"
      : indholdstype === "Brugerindsendt"
      ? "site-card-user"
      : indholdstype === "AI-assisteret"
      ? "site-card-ai"
      : "";

  const isDebat = sektion.toLowerCase() === "debat";
  const HeadingTag = headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";

  return (
    <article className={`b site-card site-card-${variant} ${markingClass}`}>
      {/* 1. Mærkningsbadge hvis ikke uafhængig */}
      {indholdstype !== "Uafhængig" && (
        <div className="site-card-marking">
          <ContentLabel
            indholdstype={indholdstype}
            sponsor={sponsor}
            afsender={afsender}
            godkendtAf={godkendtAf}
          />
        </div>
      )}

      {/* 2. Billede eller Debat-portræt */}
      {variant !== "tekst" && (
        <div className="site-card-media-wrapper">
          {isDebat && forfatter?.portraetUrl ? (
            <div className="site-card-debat-portrait">
              <Image
                src={forfatter.portraetUrl}
                alt={forfatter.navn}
                width={80}
                height={80}
                className="site-card-portrait-img"
              />
              <span className="site-card-portrait-name">{forfatter.navn}</span>
            </div>
          ) : cover?.url ? (
            <div className={`site-card-img-box site-card-img-${variant}`}>
              <Image
                src={cover.url}
                alt={cover.alt || titel}
                fill
                sizes={
                  variant === "hoved"
                    ? "(max-width: 1024px) 100vw, 760px"
                    : variant === "standard"
                    ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
                    : "100px"
                }
                priority={priority}
                className="site-card-img"
              />
            </div>
          ) : null}
        </div>
      )}

      {/* 3. Indhold (kategori, overskrift, manchet, metadata) */}
      <div className="site-card-content">
        {categoryMeta && <div className="site-card-category">{categoryMeta}</div>}

        <HeadingTag className="site-card-title">
          {breaking && <span className="site-card-breaking">BREAKING</span>}
          {debatLabel && <span className="site-card-debat-label">{debatLabel}: </span>}
          <Link href={href} className="site-card-link">
            {titel}
          </Link>
        </HeadingTag>

        {variant === "hoved" && manchet && <p className="site-card-manchet">{manchet}</p>}

        <div className="site-card-meta">
          {forfatter && !isDebat && (
            <span className="site-card-author">{forfatter.navn}</span>
          )}
          {forfatter && !isDebat && <span className="site-card-meta-dot">·</span>}
          <time dateTime={isoTime} className="site-card-time">
            {relTime}
          </time>
          {variant === "hoved" && (
            <>
              <span className="site-card-meta-dot">·</span>
              <span className="site-card-readtime">4 min. læsning</span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
