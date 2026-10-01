import Link from "next/link";
import { CalendarDays, ExternalLink } from "lucide-react";
import { CommunityBoardBlock } from "@/components/site/CommunityBoardBlock";
import { MODULE_REGISTRY } from "@/lib/frontpage/modules";
import { safeHref } from "@/lib/html-sanitize";
import { formatClock, formatDayMonth, moduleTitle } from "./render-logic";
import { SectionHead } from "./SectionHead";
import type { ModuleProps } from "./slots";
import { SlotLabel } from "./SlotLabel";

export function KalenderStrip({ module, ctx }: ModuleProps) {
  const events = ctx.extras.calendar.slice(0, module.slots);
  const title = moduleTitle(module, `Det sker i ${ctx.site.kommune}`);
  return (
    <section className="fp-panel fp-calendar" aria-labelledby={`fp-${module.id}-h`}>
      <SectionHead id={`fp-${module.id}-h`} title={title} href="/kalender" linkText="Se hele kalenderen" />
      <p className="fp-fixed-label">
        <span className="fp-label fp-label--independent">
          <CalendarDays size={14} aria-hidden="true" />
          <span>{MODULE_REGISTRY["kalender-strip"].fastMaerkning}</span>
        </span>
      </p>
      {events.length === 0 ? (
        <p className="fp-empty">
          Der er ingen arrangementer i kalenderen lige nu. <Link href="/indsend?kategori=arrangement">Indsend et arrangement</Link>
        </p>
      ) : (
        <ul className="fp-calendar-list">
          {events.map((e) => {
            const d = formatDayMonth(e.publiceretTid);
            return (
              <li key={e.id} className="fp-calendar-item">
                <div className="fp-date-box" aria-hidden="true">
                  <span className="fp-date-day">{d.dag}</span>
                  <span className="fp-date-month">{d.maaned}</span>
                </div>
                <div className="fp-calendar-body">
                  {e.indholdstype !== "Uafhængig" && (
                    <SlotLabel tekst={e.indholdstype === "PR" ? "Pressemeddelelse" : e.indholdstype} indholdstype={e.indholdstype} sponsor={e.marking?.sponsor as string | undefined} afsender={e.marking?.afsender as string | undefined} />
                  )}
                  <h3 className="fp-calendar-title">
                    <Link href={e.href}>{e.titel}</Link>
                  </h3>
                  <span className="fp-line-meta">
                    <time dateTime={new Date(e.publiceretTid).toISOString()}>{formatClock(e.publiceretTid)}</time>
                    {e.omraade ? ` · ${e.omraade.navn}` : ""}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Signaler er IKKE artikler: fast mærkning, link til kilden, aldrig AI-resumé. Skjult når der ingen er. */
export function FraKommunenPolitiet({ module, ctx }: ModuleProps) {
  const signals = (ctx.extras.signals[module.id] ?? []).slice(0, module.slots);
  if (signals.length === 0) return null;
  const isPolice = module.type === "fra-politiet";
  const title = moduleTitle(module, isPolice ? "Fra politiet" : "Fra kommunen");
  return (
    <section className="fp-panel fp-signals" aria-labelledby={`fp-${module.id}-h`}>
      <SectionHead id={`fp-${module.id}-h`} title={title} />
      <p className="fp-fixed-label">
        <span className="fp-label fp-label--machine">{MODULE_REGISTRY[module.type].fastMaerkning}</span>
      </p>
      <ul className="fp-signal-list">
        {signals.map((s) => {
          const href = safeHref(s.kildeUrl);
          return (
            <li key={s.id} className="fp-signal">
              <span className="fp-signal-meta">
                {s.kilde} · <time dateTime={s.tidspunkt}>{formatClock(s.tidspunkt)}</time>
              </span>
              {href ? (
                <a href={href} className="fp-signal-title" target="_blank" rel="noopener noreferrer nofollow">
                  {s.overskrift}
                  <ExternalLink size={14} aria-hidden="true" />
                  <span className="sr-only"> (kilde, åbner i nyt vindue)</span>
                </a>
              ) : (
                <span className="fp-signal-title">{s.overskrift}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Opslagstavle({ module, ctx }: ModuleProps) {
  return (
    <div className="fp-board">
      <p className="fp-fixed-label">
        <span className="fp-label site-badge site-badge-user fp-label--user">{MODULE_REGISTRY.opslagstavle.fastMaerkning}</span>
      </p>
      <CommunityBoardBlock siteNavn={ctx.site.navn} kommuneNavn={ctx.site.kommune} posts={ctx.extras.board.slice(0, module.slots)} />
    </div>
  );
}
