"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, ChevronRight, MapPin, Info, Send, Heart, Globe, Calendar, MessageSquare, Tag, Bookmark } from "lucide-react";
import { usePathname } from "next/navigation";
import { ALL_NETWORK_SITES, networkHref, type NetworkSiteLink } from "@/lib/network-sites";

type CategoryItem = {
  id: string;
  navn: string;
  slug: string;
  children?: Array<{ id: string; navn: string; slug: string }>;
};

type AreaItem = {
  id: string;
  navn: string;
  slug: string | null;
};

type SectionSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  areas: AreaItem[];
  siteNavn: string;
  networkSites?: NetworkSiteLink[];
  currentDomaene?: string;
  sectionPaths?: string[];
};

export function SectionSheet({
  isOpen,
  onClose,
  categories,
  areas,
  siteNavn,
  networkSites = ALL_NETWORK_SITES.map((s) => ({ ...s, origin: `https://${s.domaene}` })),
  currentDomaene,
  sectionPaths = [],
}: SectionSheetProps) {
  const pathname = usePathname();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Enkel fokusfælde: Tab cirkulerer inden for arket
      if (e.key === "Tab" && sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
      closeButtonRef.current?.focus();
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="site-sheet-backdrop" onClick={onClose}>
      <div
        className="site-sheet-content"
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-sheet-title"
        tabIndex={-1}
      >
        <div className="site-sheet-header">
          <div className="site-sheet-title" id="site-sheet-title">Udforsk {siteNavn}</div>
          <button
            type="button"
            className="site-sheet-close"
            onClick={onClose}
            aria-label="Luk menu"
            ref={closeButtonRef}
          >
            <X size={20} />
          </button>
        </div>

        <div className="site-sheet-body">
          {/* Primær og sekundær handling: Støt (fyldt) + Indsend (outline) */}
          <div className="site-sheet-cta-row">
            <Link href="/bliv-stoette" className="site-btn-support" onClick={onClose}>
              <Heart size={16} fill="currentColor" aria-hidden="true" /> Støt {siteNavn}
            </Link>
            <Link href="/indsend" className="site-btn-submit" onClick={onClose}>
              <Send size={16} aria-hidden="true" /> Indsend historie
            </Link>
          </div>

          {/* Sektioner med undersektioner */}
          <div className="site-sheet-section">
            <h3 className="site-sheet-heading">Sektioner</h3>
            <div className="site-sheet-grid">
              {categories.map((cat) => (
                <div key={cat.id} className="site-sheet-category-group">
                  <Link
                    href={`/${cat.slug}`}
                    className="site-sheet-category-title"
                    onClick={onClose}
                  >
                    <span>{cat.navn}</span>
                    <ChevronRight size={16} />
                  </Link>
                  {cat.children && cat.children.length > 0 && (
                    <ul className="site-sheet-subcategories">
                      {cat.children.map((sub) => (
                        <li key={sub.id}>
                          <Link
                            href={`/${cat.slug}/${sub.slug}`}
                            className="site-sheet-subcategory-link"
                            onClick={onClose}
                          >
                            {sub.navn}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Områder */}
          {areas.length > 0 && (
            <div className="site-sheet-section">
              <h3 className="site-sheet-heading">
                <MapPin size={16} /> Områder
              </h3>
              <div className="site-sheet-pills">
                {areas.map((area) => (
                  <Link
                    key={area.id}
                    href={`/omraade/${area.slug || area.id}`}
                    className="site-sheet-pill"
                    onClick={onClose}
                  >
                    {area.navn}
                  </Link>
                ))}
                <Link href="/omraade" className="site-sheet-pill" onClick={onClose}>
                  Alle områder →
                </Link>
              </div>
            </div>
          )}

          {/* Skift by i [By]Lokalt netværket */}
          <div className="site-sheet-section">
            <h3 className="site-sheet-heading">
              <Globe size={16} /> Skift by (søstermedier)
            </h3>
            <div className="site-sheet-pills">
              {networkSites.map((s) => {
                const isActive = currentDomaene ? s.domaene === currentDomaene : s.navn === siteNavn;
                return (
                  <a
                    key={s.domaene}
                    href={networkHref(s, pathname ?? "/", sectionPaths)}
                    className={`site-sheet-pill ${isActive ? "is-active" : ""}`}
                    style={isActive ? { backgroundColor: s.accent, color: "#fff", borderColor: s.accent } : {}}
                    onClick={onClose}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: isActive ? "#fff" : s.accent,
                        display: "inline-block",
                        marginRight: 6,
                      }}
                    />
                    {s.navn}
                  </a>
                );
              })}
            </div>
          </div>

          {/* Deltag og lokalt */}
          <div className="site-sheet-section">
            <h3 className="site-sheet-heading">Lokalt og deltagelse</h3>
            <div className="site-sheet-extra-links">
              <Link href="/kalender" className="site-sheet-extra-link" onClick={onClose}>
                <Calendar size={16} /> Det sker (kalender)
              </Link>
              <Link href="/opslagstavle" className="site-sheet-extra-link" onClick={onClose}>
                <MessageSquare size={16} /> Opslagstavlen
              </Link>
              <Link href="/emne" className="site-sheet-extra-link" onClick={onClose}>
                <Tag size={16} /> Emner
              </Link>
              <Link href="/gemte" className="site-sheet-extra-link" onClick={onClose}>
                <Bookmark size={16} /> Gemte artikler
              </Link>
              <Link href="/bliv-en-del-af-journalistikken" className="site-sheet-extra-link" onClick={onClose}>
                <Globe size={16} /> Bliv en del af journalistikken
              </Link>
              <Link href="/qa" className="site-sheet-extra-link" onClick={onClose}>
                <span>Kilde-Q&A</span>
              </Link>
              <Link href="/interview" className="site-sheet-extra-link" onClick={onClose}>
                <span>Kildeinterview</span>
              </Link>
            </div>
          </div>

          {/* Mediet og støtte */}
          <div className="site-sheet-section site-sheet-links-section">
            <h3 className="site-sheet-heading">Om mediet</h3>
            <div className="site-sheet-extra-links">
              <Link href="/sponsor" className="site-sheet-extra-link" onClick={onClose}>
                <span>Sponsor & partner</span>
              </Link>
              <Link href="/priser" className="site-sheet-extra-link" onClick={onClose}>
                <span>Priser & annoncering</span>
              </Link>
              <Link href="/om-mediet" className="site-sheet-extra-link" onClick={onClose}>
                <Info size={16} /> Om mediet & kontakt
              </Link>
              <Link href="/om-mediet/privatliv" className="site-sheet-extra-link" onClick={onClose}>
                <span>Privatliv</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
