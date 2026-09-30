import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSite } from "@/lib/site";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import {
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  Plus,
  Ticket,
  Users,
  Search,
  Filter,
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getCurrentSite();
  return {
    title: `Det sker i ${site.kommune} — Kalender & Begivenheder | ${site.navn}`,
    description: `Komplet guide til arrangementer, koncerter, loppemarkeder og foreningsaktiviteter i ${site.kommune}.`,
  };
}

export default async function KalenderPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const site = await getCurrentSite();
  const query = searchParams ? await searchParams : {};
  const filter = typeof query.filter === "string" ? query.filter : "alle";

  // Lokale arrangementer for kommunen
  const allEvents = [
    {
      id: "ev-1",
      title: "Storebæltsmarked & Kunsthåndværk på Havnepladsen",
      category: "Kultur",
      date: "I dag",
      dateFormatted: "30. SEP",
      time: "10:00 - 16:00",
      location: "Korsør Havneplads",
      area: "Korsør",
      organizer: "Korsør Erhvervs- og Borgerforening",
      price: "Gratis adgang",
      desc: "Stort lokalt marked med boder fra lokale fødevareproducenter, keramikere og glaskunstnere langs havnebassinet.",
      tag: "weekend",
    },
    {
      id: "ev-2",
      title: "Slagelse Musikhus: Koncert med Vestsjællands Symfoniorkester",
      category: "Koncert",
      date: "I aften",
      dateFormatted: "30. SEP",
      time: "19:30 - 21:45",
      location: "Slagelse Musikhus, Sdr. Stationsvej 1",
      area: "Slagelse By",
      organizer: "Vestsjællands Symfoniorkester",
      price: "Entré 120 kr.",
      desc: "Efterårskoncert med værker af Carl Nielsen og Brahms. Dirigent Anne Kathrine Friis.",
      tag: "kultur",
    },
    {
      id: "ev-3",
      title: "Åben Børnedag på Vikingeborgen Trelleborg",
      category: "Børn & Familie",
      date: "Lørdag",
      dateFormatted: "03. OKT",
      time: "11:00 - 15:30",
      location: "Trelleborg Allé 4, Hejninge",
      area: "Trelleborg",
      organizer: "Nationalmuseet Trelleborg",
      price: "Børn gratis / Voksne 80 kr.",
      desc: "Prøv vikingekamp med skjold og sværd, bag fladbrød over bål og hør sagafortællinger ved langhuset.",
      tag: "familie",
    },
    {
      id: "ev-4",
      title: "Skælskør Keramikfestival: Åbne Værksteder i Gaderne",
      category: "Kultur",
      date: "Søndag",
      dateFormatted: "04. OKT",
      time: "10:00 - 17:00",
      location: "Algade & Gammeltorv",
      area: "Skælskør",
      organizer: "Keramikernes Fællesskab",
      price: "Gratis adgang",
      desc: "Byens historiske keramikværksteder åbner dørene for offentligheden med rundvisninger og arbejdende stande.",
      tag: "kultur",
    },
    {
      id: "ev-5",
      title: "Lokaldysten: Fodboldlokalbrag Slagelse B&I vs. Ringsted IF",
      category: "Sport",
      date: "Lørdag",
      dateFormatted: "03. OKT",
      time: "14:00 - 16:00",
      location: "Harboe Arena Slagelse",
      area: "Slagelse By",
      organizer: "Slagelse B&I",
      price: "Entré 50 kr.",
      desc: "Topopgør i Danmarksserien. Kom og støt de lokale drenge i kampen om oprykning til 3. division.",
      tag: "sport",
    },
    {
      id: "ev-6",
      title: "Borgermøde om Byudvikling og Grønne Kiler i Halsskov",
      category: "Bylaug & Møder",
      date: "Tirsdag",
      dateFormatted: "06. OKT",
      time: "18:30 - 20:30",
      location: "Halsskov Forsamlingshus",
      area: "Korsør",
      organizer: "Lokalrådet for Halsskov",
      price: "Gratis med kaffe & kage",
      desc: "Præsentation af det nye forslag til stiforbindelser og rekreative områder. Åben debat med lokale byrådsmedlemmer.",
      tag: "forening",
    },
  ];

  const filteredEvents = allEvents.filter((ev) => {
    if (filter === "idag") return ev.date.includes("dag") || ev.date.includes("aften");
    if (filter === "weekend") return ev.tag === "weekend" || ev.date.includes("Lørdag") || ev.date.includes("Søndag");
    if (filter === "kultur") return ev.category === "Kultur" || ev.category === "Koncert";
    if (filter === "familie") return ev.category === "Børn & Familie";
    if (filter === "sport") return ev.category === "Sport";
    return true;
  });

  return (
    <div className="site-page-container" style={{ padding: "24px 0 64px 0" }}>
      <div className="site-container" style={{ maxWidth: "880px" }}>
        <Breadcrumbs
          items={[
            { label: "Forside", href: "/" },
            { label: "Det sker (Kalender)" },
          ]}
        />

        {/* Hero overskrift */}
        <header className="kalender-header">
          <div className="kalender-header-top">
            <div className="kalender-badge">
              <CalendarIcon size={14} />
              <span>DET SKER I {site.kommune.toUpperCase()}</span>
            </div>

            <Link
              href="/indsend?kategori=arrangement"
              className="kalender-submit-btn"
            >
              <Plus size={16} />
              <span>Indsend arrangement</span>
            </Link>
          </div>

          <h1 className="kalender-title">Kalender & Begivenheder</h1>
          <p className="kalender-desc">
            Komplet guide til koncerter, byfester, foredrag, teater, børneaktiviteter og sportsstævner i hele {site.kommune}.
            Arrangerer din forening eller klub noget? Få det gratis i kalenderen.
          </p>
        </header>

        {/* Kategori- og tidsfilter piller */}
        <div className="kalender-filters-scroll">
          <div className="kalender-filters">
            <Link
              href="/kalender"
              className={`kalender-filter-pill ${filter === "alle" ? "is-active" : ""}`}
            >
              Alle arrangementer ({allEvents.length})
            </Link>
            <Link
              href="/kalender?filter=idag"
              className={`kalender-filter-pill ${filter === "idag" ? "is-active" : ""}`}
            >
              I dag & i aften
            </Link>
            <Link
              href="/kalender?filter=weekend"
              className={`kalender-filter-pill ${filter === "weekend" ? "is-active" : ""}`}
            >
              I weekenden
            </Link>
            <Link
              href="/kalender?filter=kultur"
              className={`kalender-filter-pill ${filter === "kultur" ? "is-active" : ""}`}
            >
              Kultur & Musik
            </Link>
            <Link
              href="/kalender?filter=familie"
              className={`kalender-filter-pill ${filter === "familie" ? "is-active" : ""}`}
            >
              Børn & Familie
            </Link>
            <Link
              href="/kalender?filter=sport"
              className={`kalender-filter-pill ${filter === "sport" ? "is-active" : ""}`}
            >
              Sport & Kampe
            </Link>
          </div>
        </div>

        {/* Liste med arrangementer */}
        <div className="kalender-events-list">
          {filteredEvents.map((event) => (
            <article key={event.id} className="kalender-event-card">
              <div className="kalender-event-date-box">
                <span className="kalender-event-badge-cat">{event.category}</span>
                <span className="kalender-event-date">{event.dateFormatted}</span>
                <span className="kalender-event-day">{event.date}</span>
              </div>

              <div className="kalender-event-content">
                <div className="kalender-event-meta">
                  <span className="kalender-event-area">
                    <MapPin size={13} />
                    {event.location} ({event.area})
                  </span>
                  <span className="kalender-event-time">
                    <Clock size={13} />
                    {event.time}
                  </span>
                </div>

                <h2 className="kalender-event-title">{event.title}</h2>
                <p className="kalender-event-desc">{event.desc}</p>

                <div className="kalender-event-footer">
                  <div className="kalender-event-organizer">
                    <Users size={14} />
                    <span>Arrangør: <strong>{event.organizer}</strong></span>
                  </div>
                  <div className="kalender-event-price">
                    <Ticket size={14} />
                    <span>{event.price}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Indsend boks i bunden */}
        <div className="kalender-cta-box">
          <div className="kalender-cta-content">
            <h3 className="kalender-cta-title">Holder din klub eller forening et arrangement?</h3>
            <p className="kalender-cta-text">
              Gør opmærksom på din byfest, dit loppemarked eller din koncert over for tusindvis af lokale læsere i {site.kommune}.
            </p>
          </div>
          <Link
            href="/indsend?kategori=arrangement"
            className="kalender-submit-btn-large"
          >
            <Plus size={16} />
            <span>Opret arrangement gratis</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
