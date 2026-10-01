"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Heart, User, Bookmark } from "lucide-react";
import { ALL_NETWORK_SITES, networkHref, type NetworkSiteLink } from "@/lib/network-sites";

type CategoryItem = {
  id: string;
  navn: string;
  slug: string;
};

type SiteHeaderProps = {
  siteNavn: string;
  tagline?: string;
  categories: CategoryItem[];
  networkSites?: NetworkSiteLink[];
  currentDomaene?: string;
  /** Sektion-/undersektionsstier der findes på alle byer (bevares ved byskift). */
  sectionPaths?: string[];
};

export function SiteHeader({
  siteNavn,
  tagline,
  categories,
  networkSites = ALL_NETWORK_SITES.map((s) => ({ ...s, origin: `https://${s.domaene}` })),
  currentDomaene,
  sectionPaths = [],
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Udled aktiv sektion fra pathname
  // f.eks. /nyheder/... matcher kategorien med slug 'nyheder'
  const activeSectionSlug = pathname.split("/")[1] || "";


  // Luk dropdown ved klik uden for eller Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  return (
    <header className="site-header-wrapper">
      {/* Tilgængelighed: Hop direkte til indhold */}
      <a href="#hovedindhold" className="site-skip-link">
        Spring til indhold
      </a>

      {/* Netværks-topbar */}
      {networkSites.length > 0 && (
        <div className="site-network-bar">
          <div className="site-container site-network-bar-inner">
            <div className="site-network-bar-label">
              <span>Søstermedier:</span>
            </div>
            <ul className="site-network-bar-list">
              {networkSites.map((s) => {
                const isActive = s.domaene === currentDomaene;
                return (
                  <li key={s.domaene}>
                    {isActive ? (
                      <span className="site-network-bar-link is-active">
                        <span className="site-network-dot" style={{ backgroundColor: s.accent }} />
                        {s.navn}
                      </span>
                    ) : (
                      <a
                        href={networkHref(s, pathname, sectionPaths)}
                        className="site-network-bar-link"
                        title={`Skift til ${s.navn}`}
                      >
                        <span className="site-network-dot" style={{ backgroundColor: s.accent }} />
                        {s.navn}
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div className="site-header-topbar">
        <div className="site-container site-header-inner">
          <div className="site-header-brand">
            <Link href="/" className="site-brand-link" aria-label={`${siteNavn} forside`}>
              <span className="site-brand-logo">
                {siteNavn.endsWith("Lokalt") ? (
                  <>
                    <span>{siteNavn.replace(/Lokalt$/, "")}</span>
                    <span className="site-brand-logo-accent">Lokalt</span>
                  </>
                ) : (
                  siteNavn
                )}
              </span>
            </Link>

            {/* Primære kategorier inline til højre for logoet jf. nyeste mockup */}
            <nav className="site-header-primary-nav site-desktop-only" aria-label="Hovedkategorier">
              <ul className="site-header-primary-list">
                {categories.map((cat) => {
                  const isActive = activeSectionSlug === cat.slug;
                  return (
                    <li key={cat.id}>
                      <Link
                        href={`/${cat.slug}`}
                        className={`site-header-primary-link ${isActive ? "is-active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        {cat.navn}
                      </Link>
                    </li>
                  );
                })}
                <li>
                  <Link
                    href="/omraade"
                    className={`site-header-primary-link ${activeSectionSlug === "omraade" ? "is-active" : ""}`}
                    aria-current={activeSectionSlug === "omraade" ? "page" : undefined}
                  >
                    Områder
                  </Link>
                </li>
                <li>
                  <Link
                    href="/kalender"
                    className={`site-header-primary-link ${activeSectionSlug === "kalender" ? "is-active" : ""}`}
                    aria-current={activeSectionSlug === "kalender" ? "page" : undefined}
                  >
                    Kalender
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="site-header-actions">
            {/* Søg: ikon alene på alle skærme (label kun på brede skærme) */}
            <Link href="/soeg" className="site-header-action-btn" aria-label="Søg på sitet">
              <Search size={18} aria-hidden="true" />
              <span className="site-action-label">Søg</span>
            </Link>

            {/* Indsend = sekundær handling (outline) fra tablet og op */}
            <Link href="/indsend" className="site-header-btn-indsend-outline site-cta-tablet-up">
              <span>Indsend</span>
            </Link>

            {/* Støt = primær handling (fyldt accent), altid synlig */}
            <Link href="/bliv-stoette" className="site-header-btn-solid site-header-btn-support-primary">
              <Heart size={14} fill="currentColor" aria-hidden="true" />
              <span>Støt</span>
            </Link>

            {/* Desktop Bogmærker / Gemte */}
            <Link href="/gemte" className="site-header-icon-btn site-desktop-only site-header-icon-saved" aria-label="Gemte artikler" title="Gemte artikler">
              <Bookmark size={18} />
            </Link>

            {/* Desktop Profil / Konto */}
            <Link href="/profil" className="site-header-icon-btn site-desktop-only" aria-label="Min profil" title="Min profil">
              <User size={18} />
            </Link>
          </div>
        </div>
      </div>

      {/* Mobil sekundær navigation (vandret scroll med kategorier) */}
      <nav className="site-header-mobile-nav site-mobile-only" aria-label="Sektioner">
        <div className="site-header-mobile-scroll">
          {categories.map((cat) => {
            const isActive = activeSectionSlug === cat.slug;
            return (
              <Link
                key={cat.id}
                href={`/${cat.slug}`}
                className={`site-header-mobile-link ${isActive ? "is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {cat.navn}
              </Link>
            );
          })}
          <Link
            href="/omraade"
            className={`site-header-mobile-link ${activeSectionSlug === "omraade" ? "is-active" : ""}`}
            aria-current={activeSectionSlug === "omraade" ? "page" : undefined}
          >
            Områder
          </Link>
          <Link
            href="/kalender"
            className={`site-header-mobile-link ${activeSectionSlug === "kalender" ? "is-active" : ""}`}
            aria-current={activeSectionSlug === "kalender" ? "page" : undefined}
          >
            Kalender
          </Link>
          <Link
            href="/om-mediet"
            className={`site-header-mobile-link ${activeSectionSlug === "om-mediet" ? "is-active" : ""}`}
            aria-current={activeSectionSlug === "om-mediet" ? "page" : undefined}
          >
            Om mediet
          </Link>
        </div>
      </nav>
    </header>
  );
}
