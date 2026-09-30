"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Heart, MapPin, ChevronDown, Check } from "lucide-react";
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
            <div className="site-brand-container">
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

              {/* By-vælger dropdown knap direkte i headeren */}
              <div className="site-city-dropdown-wrapper" ref={dropdownRef}>
                <button
                  type="button"
                  className="site-city-dropdown-toggle"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-expanded={dropdownOpen}
                  aria-label="Vælg by eller medie"
                >
                  <MapPin size={13} className="site-city-pin" />
                  <span className="site-city-current">{currentSite?.by || "Skift by"}</span>
                  <ChevronDown size={13} className={`site-city-chevron ${dropdownOpen ? "is-open" : ""}`} />
                </button>

                {dropdownOpen && (
                  <div className="site-city-menu" role="menu">
                    <div className="site-city-menu-header">
                      <span className="site-city-menu-title">[By]Lokalt netværket</span>
                      <span className="site-city-menu-desc">Vælg et lokalt nyhedsmedie:</span>
                    </div>
                    <div className="site-city-menu-list">
                      {networkSites.map((s) => {
                        const isActive = s.domaene === currentDomaene;
                        return (
                          <a
                            key={s.domaene}
                            href={`/api/site/switch?site=${s.domaene}&redirect=${encodeURIComponent(pathname)}`}
                            className={`site-city-menu-item ${isActive ? "is-active" : ""}`}
                            role="menuitem"
                          >
                            <span
                              className="site-city-item-dot"
                              style={{ backgroundColor: s.accent }}
                            />
                            <div className="site-city-item-details">
                              <span className="site-city-item-name">{s.navn}</span>
                              <span className="site-city-item-meta">{s.by} Kommune · {s.domaene}</span>
                            </div>
                            {isActive ? (
                              <span className="site-city-active-tag">
                                <Check size={10} style={{ display: "inline", marginRight: "3px" }} />
                                Aktiv
                              </span>
                            ) : (
                              <span className="site-city-switch-arrow">→</span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {tagline && <span className="site-brand-tagline">{tagline}</span>}
          </div>

          <div className="site-header-actions">
            <Link href="/soeg" className="site-header-action-btn" aria-label="Søg på sitet">
              <Search size={18} />
              <span className="site-action-label">Søg</span>
            </Link>

            <Link href="/indsend" className="site-header-btn-indsend site-action-desktop-only">
              <span>Indsend historie</span>
            </Link>

            <Link href="/bliv-stoette" className="site-header-btn-support site-action-desktop-only" title="Bliv støtte">
              <Heart size={15} />
              <span>Støt</span>
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

      {/* Dekorativ accent-progresslinie fra Option 2a */}
      <div
        className="site-header-accent-line"
        style={{
          height: "3px",
          background: "linear-gradient(90deg, var(--site-accent) 28%, transparent 28%)",
        }}
        aria-hidden="true"
      />
    </header>
  );
}
