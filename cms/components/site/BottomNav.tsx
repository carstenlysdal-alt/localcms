"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, CalendarDays, Search, User } from "lucide-react";
import { SectionSheet } from "./SectionSheet";
import type { NetworkSiteLink } from "@/lib/network-sites";

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
  networkSites?: NetworkSiteLink[];
  currentDomaene?: string;
  sectionPaths?: string[];
};

export function BottomNav({
  categories,
  areas,
  siteNavn,
  networkSites,
  currentDomaene,
  sectionPaths,
}: BottomNavProps) {
  const pathname = usePathname() ?? "/";
  const [sheetOpen, setSheetOpen] = useState(false);

  // Aktiv fane følger sektionen: Sektioner lyser for alle sektions-/undersektionsstier
  // (og artikler under dem), aldrig for Forside, Kalender, Søg eller Profil.
  const firstSegment = pathname.split("/")[1] ?? "";
  const sectionSlugs = new Set(categories.map((c) => c.slug));
  const isHome = pathname === "/" && !sheetOpen;
  const isSections = sectionSlugs.has(firstSegment) || sheetOpen;
  const isCalendar = firstSegment === "kalender";
  const isSearch = firstSegment === "soeg";
  const isProfile = firstSegment === "profil" || firstSegment === "gemte";

  return (
    <>
      <nav className="site-bottom-nav" aria-label="Hovednavigation">
        <Link
          href="/"
          className={`site-bottom-nav-item ${isHome ? "is-active" : ""}`}
          aria-current={isHome ? "page" : undefined}
        >
          <Home size={22} aria-hidden="true" />
          <span>Forside</span>
        </Link>

        <button
          type="button"
          className={`site-bottom-nav-item ${isSections ? "is-active" : ""}`}
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-current={sectionSlugs.has(firstSegment) && !sheetOpen ? "page" : undefined}
        >
          <LayoutGrid size={22} aria-hidden="true" />
          <span>Sektioner</span>
        </button>

        <Link
          href="/kalender"
          className={`site-bottom-nav-item ${isCalendar ? "is-active" : ""}`}
          aria-current={isCalendar ? "page" : undefined}
        >
          <CalendarDays size={22} aria-hidden="true" />
          <span>Kalender</span>
        </Link>

        <Link
          href="/soeg"
          className={`site-bottom-nav-item ${isSearch ? "is-active" : ""}`}
          aria-current={isSearch ? "page" : undefined}
        >
          <Search size={22} aria-hidden="true" />
          <span>Søg</span>
        </Link>

        <Link
          href="/profil"
          className={`site-bottom-nav-item ${isProfile ? "is-active" : ""}`}
          aria-current={isProfile ? "page" : undefined}
        >
          <User size={22} aria-hidden="true" />
          <span>Profil</span>
        </Link>
      </nav>

      <SectionSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        categories={categories}
        areas={areas}
        siteNavn={siteNavn}
        networkSites={networkSites}
        currentDomaene={currentDomaene}
        sectionPaths={sectionPaths}
      />
    </>
  );
}
