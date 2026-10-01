import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/page-meta";
import { isGateOpen } from "@/lib/seo/page-state";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { getArticlesByTagSlugs, getLatestInSections, CALENDAR_TAG_SLUGS } from "@/lib/site-frontpage";
import { Calendar as CalendarIcon, MapPin, Clock, Plus, Users } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  return pageMeta("/kalender", (site) => ({
    title: `Det sker i ${site.kommune} – kalender`,
    description: `Arrangementer, koncerter, loppemarkeder og foreningsaktiviteter i ${site.kommune}.`,
  }), { noindex: async (site) => !(await isGateOpen("calendar", site.id)) });
}

function formatDay(d: Date) {
  return {
    dag: d.toLocaleDateString("da-DK", { day: "2-digit" }),
    maaned: d.toLocaleDateString("da-DK", { month: "short" }).replace(".", "").toUpperCase(),
    ugedag: d.toLocaleDateString("da-DK", { weekday: "long" }),
  };
}

/**
 * Kalenderen er pr. by. Der findes endnu ingen separat arrangementsmodel, så siden viser publicerede
 * artikler mærket "arrangement"/"kalender" for netop denne by. Uden data vises en ærlig tom-tilstand.
 */
export default async function KalenderPage() {
  const site = await getCurrentSite();
  const [events, kulturOgForening] = await Promise.all([
    getArticlesByTagSlugs(site.id, CALENDAR_TAG_SLUGS, 30),
    getLatestInSections(site.id, ["kultur", "foreningsliv"], 6),
  ]);

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "880px" }}>
        <Breadcrumbs items={[{ label: "Forside", href: "/" }, { label: "Det sker (Kalender)" }]} />

        <header className="kalender-header">
          <div className="kalender-header-top">
            <div className="kalender-badge">
              <CalendarIcon size={14} />
              <span>DET SKER I {site.kommune.toUpperCase()}</span>
            </div>

            <Link href="/indsend?kategori=arrangement" className="kalender-submit-btn">
              <Plus size={16} />
              <span>Indsend arrangement</span>
            </Link>
          </div>

          <h1 className="kalender-title">Kalender & begivenheder i {site.kommune}</h1>
          <p className="kalender-desc">
            Koncerter, byfester, foredrag og foreningsaktiviteter i {site.kommune}. Arrangerer din forening eller klub
            noget? Få det gratis i kalenderen.
          </p>
        </header>

        {events.length > 0 ? (
          <div className="kalender-events-list">
            {events.map((event) => {
              const day = formatDay(new Date(event.publiceretTid));
              return (
                <article key={event.id} className="kalender-event-card">
                  <div className="kalender-event-date-box">
                    <span className="kalender-event-badge-cat">{event.undersektion?.navn ?? event.sektion.navn}</span>
                    <span className="kalender-event-date">
                      {day.dag}. {day.maaned}
                    </span>
                    <span className="kalender-event-day">{day.ugedag}</span>
                  </div>
                  <div className="kalender-event-content">
                    <div className="kalender-event-meta">
                      {event.omraade && (
                        <span className="kalender-event-area">
                          <MapPin size={13} />
                          <Link href={`/omraade/${event.omraade.slug}`}>{event.omraade.navn}</Link>
                        </span>
                      )}
                      <span className="kalender-event-time">
                        <Clock size={13} />
                        Offentliggjort {new Date(event.publiceretTid).toLocaleDateString("da-DK")}
                      </span>
                    </div>
                    <h2 className="kalender-event-title">
                      <Link href={event.href}>{event.titel}</Link>
                    </h2>
                    {event.manchet && <p className="kalender-event-desc">{event.manchet}</p>}
                    {event.forfatter?.navn && (
                      <div className="kalender-event-footer">
                        <div className="kalender-event-organizer">
                          <Users size={14} />
                          <span>{event.forfatter.navn}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <section className="kalender-cta-box" aria-label="Ingen arrangementer endnu">
            <div className="kalender-cta-content">
              <h2 className="kalender-cta-title">Der er endnu ingen arrangementer i kalenderen</h2>
              <p className="kalender-cta-text">
                Kalenderen for {site.kommune} er ny. Send dit arrangement til redaktionen, så kommer det med her, så snart
                det er gennemgået.
              </p>
            </div>
            <Link href="/indsend?kategori=arrangement" className="kalender-submit-btn-large">
              <Plus size={16} />
              <span>Indsend arrangement</span>
            </Link>
          </section>
        )}

        {kulturOgForening.length > 0 && (
          <section style={{ marginTop: "40px" }} aria-label="Seneste fra kultur og foreningsliv">
            <h2 className="site-block-heading">Seneste fra kultur og foreningsliv</h2>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "10px" }}>
              {kulturOgForening.map((a) => (
                <li key={a.id}>
                  <Link href={a.href} style={{ color: "var(--ink)", fontWeight: 600 }}>
                    {a.titel}
                  </Link>{" "}
                  <span style={{ fontSize: "13px", color: "var(--ink-3)" }}>· {a.sektion.navn}</span>
                </li>
              ))}
            </ul>
            <p style={{ marginTop: "12px" }}>
              <Link href="/kultur" className="site-pill">Alle kulturnyheder</Link>{" "}
              <Link href="/foreningsliv" className="site-pill">Foreningsliv</Link>
            </p>
          </section>
        )}

        {events.length > 0 && (
          <div className="kalender-cta-box" style={{ marginTop: "32px" }}>
            <div className="kalender-cta-content">
              <h3 className="kalender-cta-title">Holder din klub eller forening et arrangement?</h3>
              <p className="kalender-cta-text">
                Gør opmærksom på din byfest, dit loppemarked eller din koncert over for lokale læsere i {site.kommune}.
              </p>
            </div>
            <Link href="/indsend?kategori=arrangement" className="kalender-submit-btn-large">
              <Plus size={16} />
              <span>Indsend arrangement</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
