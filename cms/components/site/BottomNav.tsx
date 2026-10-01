"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, LayoutGrid, Bookmark, MoreHorizontal } from "lucide-react";
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
  const isLatest = pathname.startsWith("/nyheder");
  const isSaved = pathname.startsWith("/gemte");

  return (
    <>
      <nav className="site-bottom-nav" aria-label="Mobil navigation">
        <Link
          href="/"
          className={`site-bottom-nav-item ${isHome ? "is-active" : ""}`}
          aria-current={isHome ? "page" : undefined}
        >
          <Home size={20} />
          <span>Hjem</span>
        </Link>

        <Link
          href="/nyheder"
          className={`site-bottom-nav-item ${isLatest ? "is-active" : ""}`}
          aria-current={isLatest ? "page" : undefined}
        >
          <Clock size={20} />
          <span>Seneste</span>
        </Link>

        <button
          type="button"
          className={`site-bottom-nav-item ${sheetOpen ? "is-active" : ""}`}
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          aria-label="Åbn emner og sektioner"
        >
          <LayoutGrid size={20} />
          <span>Emner</span>
        </button>

        <Link
          href="/gemte"
          className={`site-bottom-nav-item ${isSaved ? "is-active" : ""}`}
          aria-current={isSaved ? "page" : undefined}
        >
          <Bookmark size={20} />
          <span>Gemte</span>
        </Link>

        <button
          type="button"
          className="site-bottom-nav-item"
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          aria-label="Mere information og netværk"
        >
          <MoreHorizontal size={20} />
          <span>Mere</span>
        </button>
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
