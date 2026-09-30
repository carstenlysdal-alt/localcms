"use client";

import { useState, useEffect } from "react";
import { Bookmark } from "lucide-react";

interface BookmarkButtonProps {
  id: string;
  titel: string;
  href: string;
  sektion: string;
}

type SavedItem = {
  id: string;
  titel: string;
  href: string;
  sektion: string;
  savedAt: string;
};

export function BookmarkButton({ id, titel, href, sektion }: BookmarkButtonProps) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("local2027_saved_articles");
      if (stored) {
        const list: SavedItem[] = JSON.parse(stored);
        if (Array.isArray(list) && list.some((item: SavedItem) => item.href === href || item.id === id)) {
          setIsSaved(true);
        }
      }
    } catch {}
  }, [id, href]);

  const toggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const stored = localStorage.getItem("local2027_saved_articles");
      let list: SavedItem[] = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(list)) list = [];

      if (isSaved) {
        list = list.filter((item: SavedItem) => item.href !== href && item.id !== id);
        setIsSaved(false);
      } else {
        list.push({
          id: id || href,
          titel,
          href,
          sektion,
          savedAt: new Date().toISOString(),
        });
        setIsSaved(true);
      }

      localStorage.setItem("local2027_saved_articles", JSON.stringify(list));
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggleBookmark}
      className={`site-bookmark-btn ${isSaved ? "is-saved" : ""}`}
      title={isSaved ? "Fjern fra gemte artikler" : "Gem artikel til senere"}
      aria-label={isSaved ? "Fjern fra gemte artikler" : "Gem artikel"}
    >
      <Bookmark
        size={14}
        fill={isSaved ? "var(--site-accent, #BA4A28)" : "none"}
        color={isSaved ? "var(--site-accent, #BA4A28)" : "currentColor"}
      />
    </button>
  );
}
