"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Heart, MapPin, ChevronDown, Check, User, Bookmark } from "lucide-react";
import { ALL_NETWORK_SITES, type NetworkSiteSummary } from "@/lib/network-sites";

type CategoryItem = {
  id: string;
  navn: string;
  slug: string;
};

type SiteHeaderProps = {
  siteNavn: string;
  tagline?: string;
  categories: CategoryItem[];
  networkSites?: NetworkSiteSummary[];
  currentDomaene?: string;
};

export function SiteHeader({
  siteNavn,
  tagline,
  categories,
  networkSites = ALL_NETWORK_SITES,
  currentDomaene,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Udled aktiv sektion fra pathname
  // f.eks. /nyheder/... matcher kategorien med slug 'nyheder'
  const activeSectionSlug = pathname.split("/")[1] || "";

  // Find aktuelt site i listen
  const currentSite = networkSites.find((s) => s.domaene === currentDomaene) || networkSites[0];

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
              <span>[By]Lokalt netværket:</span>
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
                        href={`/api/site/switch?site=${s.domaene}&redirect=${encodeURIComponent(pathname)}`}
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
              </ul>
            </nav>
          </div>

          <div className="site-header-actions">
            {/* Desktop Søg */}
            <Link href="/soeg" className="site-header-action-btn site-desktop-only" aria-label="Søg på sitet">
              <Search size={16} />
              <span className="site-action-label">Søg</span>
            </Link>

            {/* Desktop Indsend historie (solid terrakotta pill) */}
            <Link href="/indsend" className="site-header-btn-solid site-desktop-only" aria-label="Indsend historie">
              <span>Indsend historie</span>
            </Link>

            {/* Desktop Støt (solid terrakotta pill med hjerte) */}
            <Link href="/bliv-stoette" className="site-header-btn-solid site-desktop-only" title="Bliv støtte">
              <Heart size={14} fill="currentColor" />
              <span>Støt</span>
            </Link>

            {/* Desktop Bogmærker / Gemte */}
            <Link href="/gemte" className="site-header-icon-btn site-desktop-only" aria-label="Gemte artikler" title="Gemte artikler">
              <Bookmark size={18} />
            </Link>

            {/* Desktop Profil / Konto */}
            <Link href="/login" className="site-header-icon-btn site-desktop-only" aria-label="Min konto" title="Min konto">
              <User size={18} />
            </Link>

            {/* Desktop Slogan til højre jf. mockup */}
            <div className="site-header-slogan site-desktop-only" aria-hidden="true">
              <span>Lokaljournalistik,</span>
              <span>der sætter fællesskabet først</span>
            </div>

            {/* Mobil Søg icon */}
            <Link href="/soeg" className="site-header-mobile-icon-btn site-mobile-only" aria-label="Søg">
              <Search size={20} />
            </Link>

            {/* Mobil Profil/Konto icon */}
            <Link href="/login" className="site-header-mobile-profile-btn site-mobile-only" aria-label="Min konto">
              <User size={19} />
            </Link>
          </div>
        </div>
      </div>

      {/* Mobil sekundær navigation (vandret scroll med kategorier) */}
      <nav className="site-header-mobile-nav site-mobile-only" aria-label="Kategorier mobil">
        <div className="site-header-mobile-scroll">
          {categories.map((cat) => {
            const isActive = activeSectionSlug === cat.slug;
            return (
              <Link
                key={cat.id}
                href={`/${cat.slug}`}
                className={`site-header-mobile-link ${isActive ? "is-active" : ""}`}
              >
                {cat.navn}
              </Link>
            );
          })}
          <Link
            href="/bliv-en-del-af-journalistikken"
            className="site-header-mobile-link"
          >
            Mere
          </Link>
        </div>
      </nav>
    </header>
  );
}
