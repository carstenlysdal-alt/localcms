"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, ChevronRight, MapPin, Info, Send, Heart, Globe } from "lucide-react";
import { ALL_NETWORK_SITES } from "@/lib/network-sites";

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
};

export function SectionSheet({
  isOpen,
  onClose,
  categories,
  areas,
  siteNavn,
}: SectionSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
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
    <div className="site-sheet-backdrop" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="site-sheet-content"
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="site-sheet-header">
          <div className="site-sheet-title">Udforsk {siteNavn}</div>
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
              </div>
            </div>
          )}

          {/* Skift by i [By]Lokalt netværket */}
          <div className="site-sheet-section">
            <h3 className="site-sheet-heading">
              <Globe size={16} /> Netværk: Skift medie
            </h3>
            <div className="site-sheet-pills">
              {ALL_NETWORK_SITES.map((s) => {
                const isActive = s.navn === siteNavn;
                return (
                  <a
                    key={s.domaene}
                    href={`/api/site/switch?site=${s.domaene}&redirect=/`}
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

          {/* Redaktionelle værktøjer */}
          <div className="site-sheet-section">
            <h3 className="site-sheet-heading">
              Redaktionelle værktøjer
            </h3>
            <div className="site-sheet-extra-links">
              <Link href="/qa" className="site-sheet-extra-link" onClick={onClose}>
                <span>📥 Kilde-Q&A</span>
              </Link>
              <Link href="/interview" className="site-sheet-extra-link" onClick={onClose}>
                <span>🎙️ AI Kildeinterview</span>
              </Link>
              <Link href="/sponsor" className="site-sheet-extra-link" onClick={onClose}>
                <span>🤝 Sponsor & Partner</span>
              </Link>
              <Link href="/meddeler" className="site-sheet-extra-link" onClick={onClose}>
                <span>📡 Meddeler & Tip</span>
              </Link>
              <Link href="/indsend" className="site-sheet-extra-link" onClick={onClose}>
                <span>📅 Indsend arrangement</span>
              </Link>
            </div>
          </div>

          {/* Mediet og handlinger */}
          <div className="site-sheet-section site-sheet-links-section">
            <div className="site-sheet-extra-links">
              <Link href="/meddeler?kategori=tip" className="site-sheet-extra-link" onClick={onClose}>
                <Send size={16} /> Tip redaktionen
              </Link>
              <Link href="/bliv-stoette" className="site-sheet-extra-link" onClick={onClose}>
                <Heart size={16} /> Bliv støtte eller partner
              </Link>
              <Link href="/om-mediet" className="site-sheet-extra-link" onClick={onClose}>
                <Info size={16} /> Om mediet & redaktionen
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
