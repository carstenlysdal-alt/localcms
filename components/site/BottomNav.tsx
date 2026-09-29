"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, Calendar, Search, Info } from "lucide-react";
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
  const isCalendar = pathname.startsWith("/kalender");
  const isSearch = pathname.startsWith("/soeg");
  const isAbout = pathname.startsWith("/om-mediet");

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
          href="/kalender"
          className={`site-bottom-nav-item ${isCalendar ? "is-active" : ""}`}
          aria-current={isCalendar ? "page" : undefined}
        >
          <Calendar size={20} />
          <span>Kalender</span>
        </Link>

        <Link
          href="/soeg"
          className={`site-bottom-nav-item ${isSearch ? "is-active" : ""}`}
          aria-current={isSearch ? "page" : undefined}
        >
          <Search size={20} />
          <span>Søg</span>
        </Link>

        <Link
          href="/om-mediet"
          className={`site-bottom-nav-item ${isAbout ? "is-active" : ""}`}
          aria-current={isAbout ? "page" : undefined}
        >
          <Info size={20} />
          <span>Om</span>
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
