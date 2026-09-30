import Link from "next/link";
import { Inbox, Mic, Handshake, Radio, CalendarPlus, ArrowRight } from "lucide-react";

interface AiNetworkEntryBlockProps {
  kommuneNavn: string;
}

export function AiNetworkEntryBlock({ kommuneNavn }: AiNetworkEntryBlockProps) {
  const doors = [
    {
      href: "/qa",
      badge: "Kilde-Q&A",
      icon: Inbox,
      title: "Besvar spørgsmål",
      desc: "Har journalisten sendt dig et kilde-link? Besvar spørgsmål direkte eller indsend udtalelser.",
      cta: "Gå til Q&A",
      theme: "qa",
    },
    {
      href: "/interview",
      badge: "AI Kildeinterview",
      icon: Mic,
      title: "Giv et interview",
      desc: "Gennemfør et guidet kildeinterview via tale eller tekst, præcis når det passer ind i din hverdag.",
      cta: "Start interview",
      theme: "interview",
    },
    {
      href: "/sponsor",
      badge: "Sponsor & Erhverv",
      icon: Handshake,
      title: "Lokal partnerskab",
      desc: "Fortæl din virksomheds historie med tydeligt deklareret partnerindhold over for lokale læsere.",
      cta: "Se muligheder",
      theme: "sponsor",
    },
    {
      href: "/meddeler",
      badge: "Meddeler-netværket",
      icon: Radio,
      title: "Bliv lokal meddeler",
      desc: "Rapporter fra din sportsklub, forening, beredskab eller landsby direkte til redaktionen.",
      cta: "Tilmeld som meddeler",
      theme: "meddeler",
    },
    {
      href: "/indsend",
      badge: "Arrangementer",
      icon: CalendarPlus,
      title: "Indsend arrangement",
      desc: "Få din forenings koncert, loppemarked eller generalforsamling med i den lokale kalender.",
      cta: "Indsend nu",
      theme: "indsend",
      highlight: true,
    },
  ];

  return (
    <section className="ai-entry-section" aria-label="Redaktionelle indgangsdøre og borgerdeltagelse">
      <div className="site-container">
        <div className="ai-entry-header">
          <div className="ai-entry-header-left">
            <span className="ai-entry-tag">Åbne redaktionelle indgange</span>
            <h2 className="ai-entry-title">Vær med til at skabe nyhederne i {kommuneNavn}</h2>
            <p className="ai-entry-desc">
              Vores journalistik er rodfæstet i lokalsamfundet. Uanset om du er kilde, foreningsleder,
              erhvervsdrivende eller borger, har du en direkte digital vej ind i redaktionen.
            </p>
          </div>
        </div>

        <div className="ai-entry-grid">
          {doors.map((door) => {
            const Icon = door.icon;
            return (
              <Link
                key={door.href}
                href={door.href}
                className={`ai-entry-card ${door.highlight ? "is-highlight" : ""}`}
              >
                <div className="ai-entry-card-top">
                  <div className={`ai-entry-icon-wrap ai-icon-${door.theme}`}>
                    <Icon size={20} strokeWidth={2} />
                  </div>
                  <span className="ai-entry-card-badge">{door.badge}</span>
                </div>
                <h3 className="ai-entry-card-title">{door.title}</h3>
                <p className="ai-entry-card-text">{door.desc}</p>
                <span className="ai-entry-card-cta">
                  <span>{door.cta}</span>
                  <ArrowRight size={14} />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
