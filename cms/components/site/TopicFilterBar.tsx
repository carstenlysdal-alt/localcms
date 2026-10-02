"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, ChevronDown, Check } from "lucide-react";
import { ALL_NETWORK_SITES, networkHref, type NetworkSiteLink } from "@/lib/network-sites";

type TopicFilterBarProps = {
  currentCity?: string;
  networkSites?: NetworkSiteLink[];
  sectionPaths?: string[];
  /** Topsektioner fra databasen (navn + slug). Barren viser højst 6, så navigationen er overskuelig; undersektioner findes under hver sektion. */
  sections?: Array<{ navn: string; slug: string }>;
};

export function TopicFilterBar({
  currentCity = "",
  networkSites = ALL_NETWORK_SITES.map((s) => ({ ...s, origin: `https://${s.domaene}` })),
  sectionPaths = [],
  sections = [],
}: TopicFilterBarProps) {
  const pathname = usePathname() ?? "/";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Emne-links er topsektionerne fra kategoritræet (aldrig hardcodede): de peger altid på en rigtig sektion.
  const topics = sections.slice(0, 6).map((c) => ({ key: c.slug, label: c.navn, href: `/${c.slug}` }));

  return (
    <div className="topic-filter-bar-wrapper">
      <div className="topic-filter-bar">
        {/* Byvælger jf. mockup: byvælger */}
        <div className="topic-filter-city-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="topic-filter-city-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
          >
            <MapPin size={14} className="topic-filter-city-pin" />
            <span className="topic-filter-city-name">{currentCity}</span>
            <ChevronDown size={13} className={`topic-filter-city-chevron ${dropdownOpen ? "is-open" : ""}`} />
          </button>

          {dropdownOpen && (
            <div className="site-city-menu topic-city-menu" role="menu">
              <div className="site-city-menu-header">
                <span className="site-city-menu-title">Søstermedier</span>
                <span className="site-city-menu-desc">Skift til en anden by:</span>
              </div>
              <div className="site-city-menu-list">
                {networkSites.map((s) => {
                  const isActive = s.by.toLowerCase() === currentCity.toLowerCase();
                  return (
                    <a
                      key={s.domaene}
                      href={networkHref(s, pathname, sectionPaths)}
                      className={`site-city-menu-item ${isActive ? "is-active" : ""}`}
                      role="menuitem"
                    >
                      <span className="site-city-item-dot" style={{ backgroundColor: s.accent }} />
                      <div className="site-city-item-details">
                        <span className="site-city-item-name">{s.navn}</span>
                        <span className="site-city-item-meta">{s.by} Kommune</span>
                      </div>
                      {isActive && (
                        <span className="site-city-active-tag">
                          <Check size={10} style={{ display: "inline", marginRight: "3px" }} /> Aktiv
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {topics.map((t) => {
          const isActive = pathname === t.href || (t.href !== "/omraade" && pathname.startsWith(`${t.href}/`)) || (t.href === "/omraade" && pathname.startsWith("/omraade"));
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`topic-filter-pill ${isActive ? "is-active" : ""}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

