import Link from "next/link";
import { Radio, Flame, Trophy, Calendar, Mic, ArrowRight, ShieldCheck } from "lucide-react";

interface BlivEnDelAfJournalistikkenBlockProps {
  siteNavn: string;
  kommuneNavn: string;
}

export function BlivEnDelAfJournalistikkenBlock({
  siteNavn,
  kommuneNavn,
}: BlivEnDelAfJournalistikkenBlockProps) {
  const tracks = [
    {
      kategori: "tip",
      icon: Radio,
      title: "Tip redaktionen",
      badge: "Tip os",
      desc: "Har du hørt, set eller opdaget noget, journalisterne bør undersøge? Fuld kildebeskyttelse.",
      color: "#d97706",
      bg: "#fef3c7",
    },
    {
      kategori: "haendelse",
      icon: Flame,
      title: "Hændelse lige nu",
      badge: "Akut",
      desc: "Uheld, vejr, afspærringer eller akutte observationer fra vejene og kysten i kommunen.",
      color: "#dc2626",
      bg: "#fee2e2",
    },
    {
      kategori: "sport",
      icon: Trophy,
      title: "Sport & Foreningsliv",
      badge: "Klubnyt",
      desc: "Send kampreferater, sportsresultater, oprykning eller generalforsamlinger fra din klub.",
      color: "#2563eb",
      bg: "#dbeafe",
    },
    {
      kategori: "arrangement",
      icon: Calendar,
      title: "Arrangementer",
      badge: "Kalender",
      desc: "Få koncerter, loppemarkeder, bylaugsmøder og byfester med i den lokale kalender.",
      color: "#16a34a",
      bg: "#dcfce7",
    },
  ];

  return (
    <section
      className="bliv-del-section"
      aria-label="Bliv en del af journalistikken og tip redaktionen"
    >
      <div className="bliv-del-inner">
        <div className="bliv-del-header">
          <div className="bliv-del-header-left">
            <div className="bliv-del-badge">
              <span className="bliv-del-badge-dot" />
              <span>Lokalt kildenetværk · Borgerjournalistik</span>
            </div>
            <h2 className="bliv-del-title">
              Bliv en del af journalistikken i {kommuneNavn}
            </h2>
            <p className="bliv-del-subtitle">
              Ingen kender lokalsamfundet bedre end dem, der selv er til stede. På {siteNavn}s
              meddelerplatform kan du tippe redaktionen, berette fra din forening og indsende din egen
              historie via tale, tekst og billeder.
            </p>
          </div>

          <div className="bliv-del-header-actions">
            <Link
              href="/bliv-en-del-af-journalistikken"
              className="bliv-del-primary-btn"
            >
              <span>Indsend din historie her</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/indsend?kategori=tip"
              className="bliv-del-secondary-btn"
            >
              <Radio size={15} />
              <span>Tip os nu</span>
            </Link>
          </div>
        </div>

        {/* 4 kategorier som hurtig-indgange */}
        <div className="bliv-del-grid">
          {tracks.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.kategori}
                href={`/bliv-en-del-af-journalistikken?kategori=${t.kategori}`}
                className="bliv-del-card"
              >
                <div className="bliv-del-card-top">
                  <div
                    className="bliv-del-card-icon"
                    style={{ backgroundColor: t.bg, color: t.color }}
                  >
                    <Icon size={18} strokeWidth={2.2} />
                  </div>
                  <span
                    className="bliv-del-card-badge"
                    style={{ color: t.color, backgroundColor: t.bg }}
                  >
                    {t.badge}
                  </span>
                </div>
                <h3 className="bliv-del-card-title">{t.title}</h3>
                <p className="bliv-del-card-desc">{t.desc}</p>
                <span className="bliv-del-card-cta">
                  <span>Indsend {t.title.toLowerCase()}</span>
                  <ArrowRight size={13} />
                </span>
              </Link>
            );
          })}
        </div>

        {/* Tillids-strip med kildebeskyttelse og taleoptager */}
        <div className="bliv-del-footer">
          <div className="bliv-del-footer-item">
            <ShieldCheck size={16} className="bliv-del-footer-icon" />
            <span>Fuld kildebeskyttelse & fortrolighed</span>
          </div>
          <div className="bliv-del-footer-divider">·</div>
          <div className="bliv-del-footer-item">
            <Mic size={16} className="bliv-del-footer-icon" />
            <span>Indtal direkte med mikrofonen eller skriv</span>
          </div>
          <div className="bliv-del-footer-divider">·</div>
          <div className="bliv-del-footer-item">
            <Radio size={16} className="bliv-del-footer-icon" />
            <span>Følg dit tip med din personlige nøglekode</span>
          </div>
        </div>
      </div>
    </section>
  );
}
