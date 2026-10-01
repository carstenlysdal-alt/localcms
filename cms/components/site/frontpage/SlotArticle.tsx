import Link from "next/link";
import { ArticleCard, type ArticleCardData } from "@/components/site/ArticleCard";
import { VARIANT_RULES } from "@/lib/frontpage/modules";
import type { SlotAssignment, Variant } from "@/lib/frontpage/types";
import type { PublicArticleSummary } from "@/lib/site-queries";
import { formatShortWhen, labelText } from "./render-logic";
import { SlotLabel } from "./SlotLabel";

export function toCardData(a: PublicArticleSummary): ArticleCardData {
  return {
    titel: a.titel,
    manchet: a.manchet || undefined,
    href: a.href,
    sektion: a.sektion.navn,
    undersektion: a.undersektion?.navn,
    omraade: a.omraade?.navn,
    cover: a.coverMedia ? { url: a.coverMedia.url, alt: a.coverMedia.altTekst || a.titel } : null,
    forfatter: a.forfatter ? { navn: a.forfatter.navn, portraetUrl: a.forfatter.profilbilledeUrl } : null,
    publiceret: a.publiceretTid,
    indholdstype: a.indholdstype,
    sponsor: a.marking?.sponsor as string | undefined,
    afsender: a.marking?.afsender as string | undefined,
    godkendtAf: a.marking?.godkendtAf as string | undefined,
    breaking: a.breaking,
  };
}

export const slotAttrs = (a: Pick<SlotAssignment, "moduleId" | "slotIndex" | "articleId">) => ({
  "data-fp-module": a.moduleId,
  "data-fp-slot": String(a.slotIndex),
  "data-fp-article": a.articleId,
});

export function labelFor(assignment: SlotAssignment, article: PublicArticleSummary, onDark = false) {
  return (
    <SlotLabel
      tekst={labelText(assignment.label, article.indholdstype)}
      indholdstype={article.indholdstype}
      sponsor={article.marking?.sponsor as string | undefined}
      afsender={article.marking?.afsender as string | undefined}
      godkendtAf={article.marking?.godkendtAf as string | undefined}
      onDark={onDark}
    />
  );
}

interface Props {
  assignment: SlotAssignment;
  article: PublicArticleSummary;
  /** Overstyr variant (ellers placeringens). */
  variant?: Variant;
  headingLevel?: 2 | 3 | 4;
  priority?: boolean;
}

/**
 * Én artikel i ét slot. Genbruger ArticleCard til kort/kompakt; liste/tekstlinje er egne linjer.
 * Mærkningen (assignment.label) står ALTID i en egen række i samme DOM-blok som titlen, i alle varianter.
 * ArticleCards indbyggede badge skjules med CSS (.fp-slot .site-card-marking) for ikke at dobbelt-mærke.
 */
export function SlotArticle({ assignment, article, variant, headingLevel = 3, priority }: Props) {
  const v: Variant = variant ?? assignment.variant;
  const attrs = slotAttrs(assignment);
  const maxTitle = VARIANT_RULES[v].maxTitelTegn;

  if (v === "liste" || v === "tekstlinje") {
    const Heading = headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";
    return (
      <div className={`fp-slot fp-slot--${v}`} {...attrs}>
        <div className="fp-line">
          {v === "liste" && (
            <time className="fp-line-time site-tabular-nums" dateTime={new Date(article.publiceretTid).toISOString()}>
              {formatShortWhen(article.publiceretTid)}
            </time>
          )}
          <div className="fp-line-body">
            <div className="fp-slot-label">{labelFor(assignment, article)}</div>
            <Heading className="fp-line-title" data-max-chars={maxTitle}>
              {article.breaking && <span className="site-card-breaking">BREAKING</span>}
              <Link href={article.href}>{article.titel}</Link>
            </Heading>
            {v === "liste" && (article.undersektion || article.omraade) && (
              <span className="fp-line-meta">{[article.undersektion?.navn ?? article.sektion.navn, article.omraade?.navn].filter(Boolean).join(" · ")}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  const card = v === "kompakt" ? "kompakt" : v === "hero" ? "hoved" : "standard";
  return (
    <div className={`fp-slot fp-slot--${v}`} {...attrs}>
      <div className="fp-slot-label">{labelFor(assignment, article)}</div>
      <ArticleCard variant={card} article={toCardData(article)} headingLevel={headingLevel} priority={priority} />
    </div>
  );
}
