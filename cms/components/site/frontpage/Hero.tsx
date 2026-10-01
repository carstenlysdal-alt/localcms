import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatRelativeTime } from "@/lib/site-queries";
import { filledSlots, type ModuleProps } from "./slots";
import { labelFor, slotAttrs } from "./SlotArticle";

export function Hero({ module, ctx }: ModuleProps) {
  const slot = filledSlots(ctx, module)[0];
  if (!slot) {
    return (
      <section className="fp-hero fp-hero--empty" aria-label="Tophistorie">
        <div className="site-hero-overlay-card" style={{ background: "var(--site-accent-strong)" }}>
          <div className="site-hero-overlay-content">
            <div className="site-hero-overlay-kicker">{ctx.site.kommune.toUpperCase()}</div>
            <h1 className="site-hero-overlay-title">Velkommen til {ctx.site.navn}</h1>
            <p className="site-hero-overlay-manchet">Der er endnu ingen historier på forsiden. Har du et tip eller en historie fra {ctx.site.kommune}?</p>
            <div className="site-hero-overlay-actions">
              <Link href="/indsend" className="site-hero-btn-read">
                <span>Send et tip til redaktionen</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }
  const { assignment, article } = slot;
  const cover = article.coverMedia;
  return (
    <section className="fp-hero" aria-label="Tophistorie" {...slotAttrs(assignment)}>
      <div className="site-hero-overlay-card" style={!cover ? { background: "var(--site-accent-strong)" } : undefined}>
        {cover && <Image src={cover.url} alt={cover.altTekst || article.titel} fill sizes="(max-width: 1024px) 100vw, 800px" priority className="site-hero-overlay-bg" style={{ objectFit: "cover" }} />}
        <div className="site-hero-overlay-gradient" />
        <div className="site-hero-overlay-content">
          <div className="fp-hero-label">{labelFor(assignment, article, true)}</div>
          <div className="site-hero-overlay-kicker">{`${article.sektion.navn.toUpperCase()} · ${(article.omraade?.navn || ctx.site.kommune).toUpperCase()}`}</div>
          <h1 className="site-hero-overlay-title fp-hero-title">
            <Link href={article.href}>{article.titel}</Link>
          </h1>
          {article.manchet && <p className="site-hero-overlay-manchet">{article.manchet}</p>}
          <div className="site-hero-overlay-actions">
            <div className="fp-hero-actions">
              <Link href={article.href} className="site-hero-btn-read">
                <span>Læs artiklen</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <div className="site-hero-overlay-byline">
                {article.forfatter?.navn && (
                  <>
                    <span>{article.forfatter.navn}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>{formatRelativeTime(article.publiceretTid)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
