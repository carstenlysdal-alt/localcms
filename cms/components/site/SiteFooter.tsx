import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getCurrentSite, getNetworkLinks } from "@/lib/site";
import { networkHref } from "@/lib/network-sites";

type CategoryItem = {
  id: string;
  navn: string;
  slug: string;
};

type SiteFooterProps = {
  siteNavn: string;
  tagline?: string;
  categories: CategoryItem[];
  /** Bevaret for bagudkompatibilitet – søstermedier beregnes nu server-side med korrekte links. */
  netvaerk?: Array<{ navn: string; domaene: string; by: string }>;
};

export async function SiteFooter({
  siteNavn,
  tagline,
  categories,
}: SiteFooterProps) {
  const [site, networkLinks] = await Promise.all([getCurrentSite(), getNetworkLinks()]);
  const sisterSites = networkLinks.filter((s) => s.domaene !== site.domaene);

  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="site-footer-grid">
          {/* Kolonne 1: Brand & vision */}
          <div className="site-footer-brand-col">
            <div className="site-footer-logo">{siteNavn}</div>
            <p className="site-footer-desc">
              {tagline || "Lokaljournalistik, der sætter fællesskabet og demokratiet først."}
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
              <li>
                <Link href="/omraade">Områder i {site.kommune}</Link>
              </li>
              <li>
                <Link href="/emne">Emner</Link>
              </li>
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
                <Link href="/kalender">Det sker (kalender)</Link>
              </li>
              <li>
                <Link href="/opslagstavle">Opslagstavlen</Link>
              </li>
              <li>
                <Link href="/nyhedsbrev">Nyhedsbrev</Link>
              </li>
              <li>
                <Link href="/bliv-stoette">Bliv lokal støtte</Link>
              </li>
              <li>
                <Link href="/bliv-en-del-af-journalistikken">Bliv en del af journalistikken</Link>
              </li>
              <li>
                <Link href="/soeg">Søg i arkivet</Link>
              </li>
              <li>
                <Link href="/feed.xml">RSS-feed</Link>
              </li>
            </ul>
          </div>

          {/* Kolonne 3b: Annoncering og samarbejde */}
          <div className="site-footer-nav-col">
            <h4 className="site-footer-heading">Annoncering</h4>
            <ul className="site-footer-links">
              <li>
                <Link href="/priser">Priser & annoncering</Link>
              </li>
              <li>
                <Link href="/sponsor">Sponsor & partner</Link>
              </li>
              <li>
                <Link href="/qa">Kilde-Q&A</Link>
              </li>
              <li>
                <Link href="/interview">Kildeinterview</Link>
              </li>
            </ul>
          </div>

          {/* Kolonne 4: Om mediet */}
          <div className="site-footer-nav-col">
            <h4 className="site-footer-heading">Om mediet</h4>
            <ul className="site-footer-links">
              <li>
                <Link href="/om-mediet">Om {siteNavn}</Link>
              </li>
              <li>
                <Link href="/om-mediet/kontakt">Kontakt redaktionen</Link>
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
                <Link href="/velkommen">Ny her? Velkommen</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Søstermedier i netværket – rigtige links til målbyens domæne */}
        {sisterSites.length > 0 && (
          <div className="site-footer-network">
            <span className="site-footer-network-label">Søstermedier i netværket:</span>
            <div className="site-footer-network-links">
              {sisterSites.map((s) => (
                <a key={s.domaene} href={networkHref(s, "/")} className="site-footer-network-item">
                  {s.navn}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Bundlinie med disclaimer og copyright */}
        <div className="site-footer-bottom">
          <p className="site-footer-disclaimer">
            {siteNavn} udgives som et digitalt lokalmedie forankret i fællesskabet. Vi anvender ingen kommercielle
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
