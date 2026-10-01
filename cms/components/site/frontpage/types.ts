import type { ModuleInstance } from "@/lib/frontpage/layout-schema";
import type { SlotAssignment } from "@/lib/frontpage/types";
import type { PublicArticleSummary } from "@/lib/site-queries";

export interface AdData {
  id: string;
  titel: string;
  annoncoer: string;
  format: string;
  placeringZone: string;
  kreativData: { overskrift?: string; manchet?: string; ctaTekst?: string; linkUrl?: string; badgeTekst?: string; farve?: string; billedeUrl?: string };
}

export interface SignalData {
  id: string;
  overskrift: string;
  kilde: string;
  kildeUrl: string | null;
  sourceType: string | null;
  tidspunkt: string; // ISO
}

export interface FrontpageExtras {
  ads: AdData[];
  calendar: PublicArticleSummary[];
  board: PublicArticleSummary[];
  /** Signaler pr. modul-id (fra-kommunen / fra-politiet). */
  signals: Record<string, SignalData[]>;
  /** sektion-slug -> navn */
  sectionNames: Record<string, string>;
}

export interface FrontpageRenderContext {
  site: { id: string; navn: string; kommune: string };
  /** Alle moduler (inkl. inline-breaks, som værten slår op i). */
  modules: ModuleInstance[];
  assignments: Record<string, SlotAssignment[]>;
  articles: Record<string, PublicArticleSummary>;
  extras: FrontpageExtras;
}

export const EMPTY_EXTRAS: FrontpageExtras = { ads: [], calendar: [], board: [], signals: {}, sectionNames: {} };
