import Link from "next/link";

interface WeekendCalendarProps {
  kommuneNavn: string;
}

// Lokale weekend- og dagsbegivenheder tilpasset hver kommune
const LOCAL_EVENTS: Record<
  string,
  Array<{ dag: string; maaned: string; titel: string; info: string; sted: string }>
> = {
  Slagelse: [
    {
      dag: "03",
      maaned: "OKT",
      titel: "Høstmarked på Slagelse Torv",
      info: "10–16 · Gratis adgang",
      sted: "Slagelse By",
    },
    {
      dag: "04",
      maaned: "OKT",
      titel: "Jazz & Blues i Korsør Kulturhus",
      info: "20.00 · 120 kr.",
      sted: "Korsør",
    },
    {
      dag: "05",
      maaned: "OKT",
      titel: "Familiedag på Slagelse Museum",
      info: "11–15 · Børn gratis",
      sted: "Slagelse By",
    },
  ],
  Næstved: [
    {
      dag: "03",
      maaned: "OKT",
      titel: "Lokal Torvedag & Smagsprøver",
      info: "09–14 · Gratis adgang",
      sted: "Axeltorv, Næstved",
    },
    {
      dag: "04",
      maaned: "OKT",
      titel: "Koncert på Grønnegades Kaserne",
      info: "20.30 · 150 kr.",
      sted: "Grønnegade Kulturcenter",
    },
    {
      dag: "05",
      maaned: "OKT",
      titel: "Fisketur og kystfortællinger",
      info: "10–13 · Gratis",
      sted: "Karrebæksminde",
    },
  ],
  Holbæk: [
    {
      dag: "03",
      maaned: "OKT",
      titel: "Fjordens Dag og Sejltur",
      info: "10–16 · Gratis",
      sted: "Holbæk Gl. Havn",
    },
    {
      dag: "04",
      maaned: "OKT",
      titel: "Teateraften i Sidesporet",
      info: "19.30 · 140 kr.",
      sted: "Holbæk By",
    },
    {
      dag: "05",
      maaned: "OKT",
      titel: "Efterårsmarked i Jyderup Hallen",
      info: "11–15 · Gratis adgang",
      sted: "Jyderup",
    },
  ],
  Ringsted: [
    {
      dag: "03",
      maaned: "OKT",
      titel: "Børneteater i Ringsted Kulturhus",
      info: "11–12.30 · 50 kr.",
      sted: "Ringsted By",
    },
    {
      dag: "04",
      maaned: "OKT",
      titel: "Klassisk Koncert i Sct. Bendts Kirke",
      info: "19.30 · Gratis",
      sted: "Ringsted By",
    },
    {
      dag: "05",
      maaned: "OKT",
      titel: "Svampetur i Jystrup Skovene",
      info: "10–13 · Frivilligt bidrag",
      sted: "Jystrup",
    },
  ],
  Køge: [
    {
      dag: "03",
      maaned: "OKT",
      titel: "Køge Torvedag & Lokalt Håndværk",
      info: "08–15 · Gratis",
      sted: "Køge Torv",
    },
    {
      dag: "04",
      maaned: "OKT",
      titel: "Folkemusik på Teaterbygningen",
      info: "20.00 · 125 kr.",
      sted: "Køge By",
    },
    {
      dag: "05",
      maaned: "OKT",
      titel: "Familieløb ved Herfølge Stadion",
      info: "10.00 · Gratis deltagelse",
      sted: "Herfølge",
    },
  ],
  Roskilde: [
    {
      dag: "03",
      maaned: "OKT",
      titel: "Lysfest i Roskilde Bypark",
      info: "18–22 · Gratis",
      sted: "Byparken, Roskilde",
    },
    {
      dag: "04",
      maaned: "OKT",
      titel: "Orgelkoncert i Roskilde Domkirke",
      info: "16.00 · 80 kr.",
      sted: "Roskilde By",
    },
    {
      dag: "05",
      maaned: "OKT",
      titel: "Vikingeværksted for børn og voksne",
      info: "11–15 · Almindelig entré",
      sted: "Vikingeskibsmuseet",
    },
  ],
};

export function WeekendCalendar({ kommuneNavn }: WeekendCalendarProps) {
  const events = LOCAL_EVENTS[kommuneNavn] || LOCAL_EVENTS.Slagelse;

  return (
    <div className="b site-calendar-box">
      <div className="site-calendar-header">
        <span className="site-calendar-title">I DAG OG I WEEKENDEN</span>
      </div>

      <div className="site-calendar-list">
        {events.map((ev, idx) => (
          <div key={idx} className="site-calendar-item">
            <div className="site-calendar-date-pill">
              <div className="site-calendar-day">{ev.dag}</div>
              <div className="site-calendar-month">{ev.maaned}</div>
            </div>
            <div className="site-calendar-details">
              <h4 className="site-calendar-item-title">{ev.titel}</h4>
              <div className="site-calendar-meta">{ev.info} · {ev.sted}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="site-calendar-footer">
        <Link href="/kalender" className="site-calendar-cta-link">
          Hele kalenderen →
        </Link>
      </div>
    </div>
  );
}
