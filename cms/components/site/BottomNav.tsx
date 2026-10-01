"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, Bookmark, Heart } from "lucide-react";
import { SectionSheet } from "./SectionSheet";

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

type BottomNavProps = {
  categories: CategoryItem[];
  areas: AreaItem[];
  siteNavn: string;
};

export function BottomNav({ categories, areas, siteNavn }: BottomNavProps) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isHome = pathname === "/";
  const isSaved = pathname.startsWith("/gemte");
  const isSupport = pathname.startsWith("/bliv-stoette") || pathname.startsWith("/stoet");

  return (
    <>
      <nav className="site-bottom-nav" aria-label="Mobil navigation">
        <Link
          href="/"
          className={`site-bottom-nav-item ${isHome ? "is-active" : ""}`}
          aria-current={isHome ? "page" : undefined}
        >
          <Home size={20} />
          <span>Forside</span>
        </Link>

        <button
          type="button"
          className={`site-bottom-nav-item ${sheetOpen ? "is-active" : ""}`}
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          aria-label="Åbn sektioner og emner"
        >
          <Layers size={20} />
          <span>Sektioner</span>
        </button>

        <Link
          href="/gemte"
          className={`site-bottom-nav-item ${isSaved ? "is-active" : ""}`}
          aria-current={isSaved ? "page" : undefined}
        >
          <Bookmark size={20} />
          <span>Gemte</span>
        </Link>

        <Link
          href="/bliv-stoette"
          className={`site-bottom-nav-item ${isSupport ? "is-active" : ""}`}
          aria-current={isSupport ? "page" : undefined}
        >
          <Heart size={20} />
          <span>Støt</span>
        </Link>
      </nav>

      <SectionSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        categories={categories}
        areas={areas}
        siteNavn={siteNavn}
      />
    </>
  );
}
