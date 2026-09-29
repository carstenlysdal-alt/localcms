"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Send, Heart } from "lucide-react";

type CategoryItem = {
  id: string;
  navn: string;
  slug: string;
};

type SiteHeaderProps = {
  siteNavn: string;
  tagline?: string;
  categories: CategoryItem[];
};

export function SiteHeader({ siteNavn, tagline, categories }: SiteHeaderProps) {
  const pathname = usePathname();

  // Udled aktiv sektion fra pathname
  // f.eks. /nyheder/... matcher kategorien med slug 'nyheder'
  const activeSectionSlug = pathname.split("/")[1] || "";

  return (
    <header className="site-header-wrapper">
      {/* Tilgængelighed: Hop direkte til indhold */}
      <a href="#hovedindhold" className="site-skip-link">
        Spring til indhold
      </a>

      {/* Topbar */}
      <div className="site-header-topbar">
        <div className="site-container site-header-inner">
          <div className="site-header-brand">
            <Link href="/" className="site-brand-link" aria-label={`${siteNavn} forside`}>
              <span className="site-brand-logo">{siteNavn}</span>
            </Link>
            {tagline && <span className="site-brand-tagline">{tagline}</span>}
          </div>

          <div className="site-header-actions">
            <Link href="/soeg" className="site-header-action-btn" aria-label="Søg på sitet">
              <Search size={18} />
              <span className="site-action-label">Søg</span>
            </Link>

            <Link href="/indsend" className="site-header-action-btn site-action-desktop-only">
              <Send size={16} />
              <span>Indsend tip</span>
            </Link>

            <Link href="/bliv-stoette" className="site-header-btn-support site-action-desktop-only">
              <Heart size={15} />
              <span>Bliv støtte</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Sektionsbar (under topbaren) */}
      <nav className="site-header-nav" aria-label="Hovedsektioner">
        <div className="site-container site-header-nav-container">
          <ul className="site-nav-list">
            <li>
              <Link
                href="/"
                className={`site-nav-link ${pathname === "/" ? "is-active" : ""}`}
                aria-current={pathname === "/" ? "page" : undefined}
              >
                Forside
              </Link>
            </li>
            {categories.map((cat) => {
              const isActive = activeSectionSlug === cat.slug;
              return (
                <li key={cat.id}>
                  <Link
                    href={`/${cat.slug}`}
                    className={`site-nav-link ${isActive ? "is-active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {cat.navn}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    </header>
  );
}
