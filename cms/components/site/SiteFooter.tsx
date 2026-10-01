import Link from "next/link";
import { ShieldCheck } from "lucide-react";

type CategoryItem = {
  id: string;
  navn: string;
  slug: string;
};

type SiteFooterProps = {
  siteNavn: string;
  tagline?: string;
  categories: CategoryItem[];
  netvaerk?: Array<{ navn: string; domaene: string; by: string }>;
};

export function SiteFooter({
  siteNavn,
  tagline,
  categories,
  netvaerk = [],
}: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="site-footer-grid">
          {/* Kolonne 1: Brand & vision */}
          <div className="site-footer-brand-col">
            <div className="site-footer-logo">{siteNavn}</div>
            <p className="site-footer-desc">
              {tagline || "Uafhængig lokaljournalistik, der sætter fællesskabet og demokratiet først."}
            </p>
            <div className="site-footer-trust-badge">
              <ShieldCheck size={18} />
              <span>Forpligtet på de presseetiske regler og fuld åbenhed om finansiering.</span>
            </div>
          </div>

          {/* Kolonne 2: Sektioner */}
          <div className="site-footer-nav-col">
            <h4 className="site-footer-heading">Sektioner</h4>
            <ul className="site-footer-links">
              <li>
                <Link href="/">Forside</Link>
              </li>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link href={`/${cat.slug}`}>{cat.navn}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kolonne 3: Værktøjer og deltagelse */}
          <div className="site-footer-nav-col">
            <h4 className="site-footer-heading">Deltag</h4>
            <ul className="site-footer-links">
              <li>
                <Link href="/indsend">Indsend tip eller læserbrev</Link>
              </li>
              <li>
                <Link href="/nyhedsbrev">Nyhedsbrev</Link>
              </li>
              <li>
                <Link href="/bliv-stoette">Bliv lokal støtte</Link>
              </li>
              <li>
                <Link href="/kalender">Det sker (Kalender)</Link>
              </li>
              <li>
                <Link href="/soeg">Søg i arkivet</Link>
              </li>
              <li>
                <Link href="/feed.xml">RSS Feed</Link>
              </li>
            </ul>
          </div>

          {/* Kolonne 4: Om mediet */}
          <div className="site-footer-nav-col">
            <h4 className="site-footer-heading">Om mediet</h4>
            <ul className="site-footer-links">
              <li>
                <Link href="/om-mediet">Redaktionen & kontakt</Link>
              </li>
              <li>
                <Link href="/om-mediet/redaktionelle-principper">Redaktionelle principper</Link>
              </li>
              <li>
                <Link href="/om-mediet/rettelser">Rettelser & præciseringer</Link>
              </li>
              <li>
                <Link href="/om-mediet/privatliv">Privatliv & databeskyttelse</Link>
              </li>
              <li>
                <Link href="/redaktion" className="site-footer-admin-link">
                  Redaktionsadgang
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Søstersites i netværket */}
        {netvaerk.length > 0 && (
          <div className="site-footer-network">
            <span className="site-footer-network-label">En del af [By]Lokalt-netværket:</span>
            <div className="site-footer-network-links">
              {netvaerk.map((site) => (
                <a
                  key={site.domaene}
                  href={`/api/site/switch?site=${site.domaene}&redirect=/`}
                  className="site-footer-network-item"
                >
                  {site.navn}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Bundlinie med disclaimer og copyright */}
        <div className="site-footer-bottom">
          <p className="site-footer-disclaimer">
            {siteNavn} udgives som et uafhængigt digitalt lokalmedie. Vi anvender ingen kommercielle
            sporingscookies eller tredjeparts-annoncenetværk.
          </p>
          <div className="site-footer-copy">
            © {new Date().getFullYear()} {siteNavn}. Alle rettigheder forbeholdes.
          </div>
        </div>
      </div>
    </footer>
  );
}
