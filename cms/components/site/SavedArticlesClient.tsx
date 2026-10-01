"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bookmark, ArrowRight, Trash2, BookOpen } from "lucide-react";

interface SavedArticle {
  id: string;
  titel: string;
  href: string;
  sektion: string;
  savedAt: string;
}

export function SavedArticlesClient({ siteNavn }: { siteNavn: string }) {
  const [saved, setSaved] = useState<SavedArticle[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("local2027_saved_articles");
      if (stored) {
        setSaved(JSON.parse(stored));
      }
    } catch {}
    setLoaded(true);
  }, []);

  const handleRemove = (id: string) => {
    const next = saved.filter((a) => a.id !== id);
    setSaved(next);
    try {
      localStorage.setItem("local2027_saved_articles", JSON.stringify(next));
    } catch {}
  };

  const handleClearAll = () => {
    if (confirm("Vil du fjerne alle gemte artikler?")) {
      setSaved([]);
      try {
        localStorage.removeItem("local2027_saved_articles");
      } catch {}
    }
  };

  if (!loaded) return null;

  return (
    <div className="saved-articles-container">
      <div className="saved-articles-header">
        <div>
          <h1 className="saved-articles-title">Gemte artikler</h1>
          <p className="saved-articles-subtitle">
            Dine bogmærkede nyheder og historier på {siteNavn}. Gemt lokalt på denne enhed.
          </p>
        </div>

        {saved.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="saved-articles-clear-btn"
          >
            Ryd alle
          </button>
        )}
      </div>

      {saved.length === 0 ? (
        <div className="saved-articles-empty">
          <Bookmark size={48} className="saved-articles-empty-icon" />
          <h2 className="saved-articles-empty-title">Du har ingen gemte artikler endnu</h2>
          <p className="saved-articles-empty-desc">
            Når du læser nyheder på {siteNavn}, kan du klikke på bogmærket for at gemme artikler til senere læsning.
          </p>
          <Link href="/" className="saved-articles-btn-home">
            Gå på opdagelse i nyhederne
          </Link>
        </div>
      ) : (
        <div className="saved-articles-list">
          {saved.map((art) => (
            <article key={art.id} className="saved-article-row">
              <div className="saved-article-info">
                <span className="saved-article-section">{art.sektion}</span>
                <Link href={art.href} className="saved-article-title-link">
                  {art.titel}
                </Link>
                <span className="saved-article-date">
                  Gemt {new Date(art.savedAt).toLocaleDateString("da-DK")}
                </span>
              </div>

              <div className="saved-article-actions">
                <Link href={art.href} className="saved-article-read-btn">
                  <span>Læs</span>
                  <ArrowRight size={14} />
                </Link>
                <button
                  type="button"
                  onClick={() => handleRemove(art.id)}
                  className="saved-article-delete-btn"
                  title="Fjern fra gemte"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
