"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MapPin, ChevronDown, Check } from "lucide-react";
import { ALL_NETWORK_SITES } from "@/lib/network-sites";

export function TopicFilterBar({ currentCity = "Slagelse" }: { currentCity?: string }) {
  const searchParams = useSearchParams();
  const activeEmne = searchParams.get("emne") || "alle";
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

  const topics = [
    { key: "nabolag", label: "Mit nabolag", href: "/nyheder?emne=nabolag" },
    { key: "sundhed", label: "Sundhed", href: "/nyheder?emne=sundhed" },
    { key: "skole", label: "Skole og børn", href: "/nyheder?emne=skole" },
    { key: "trafik", label: "Trafik", href: "/nyheder?emne=trafik" },
    { key: "krimi", label: "Krimi og retsvæsen", href: "/nyheder?emne=krimi" },
    { key: "bolig", label: "Bolig og byggeri", href: "/nyheder?emne=bolig" },
    { key: "natur", label: "Natur og klima", href: "/nyheder?emne=natur" },
    { key: "politik", label: "Politik", href: "/nyheder?emne=politik" },
  ];

  return (
    <div className="topic-filter-bar-wrapper">
      <div className="topic-filter-bar">
        {/* Byvælger jf. mockup: 📍 Slagelse ▾ */}
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
                <span className="site-city-menu-title">[By]Lokalt netværket</span>
                <span className="site-city-menu-desc">Vælg et lokalt medie:</span>
              </div>
              <div className="site-city-menu-list">
                {ALL_NETWORK_SITES.map((s) => {
                  const isActive = s.by.toLowerCase() === currentCity.toLowerCase();
                  return (
                    <a
                      key={s.domaene}
                      href={`/api/site/switch?site=${s.domaene}&redirect=${encodeURIComponent("/")}`}
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
          const isActive = activeEmne === t.key;
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

