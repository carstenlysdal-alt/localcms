import type { ModuleInstance } from "@/lib/frontpage/layout-schema";
import { getModuleDef } from "@/lib/frontpage/modules";
import type { SlotAssignment } from "@/lib/frontpage/types";

/**
 * Rene hjælpefunktioner til den modulære forside (ingen React, ingen I/O) – testbare.
 */

export type LayoutRow =
  | { kind: "full"; module: ModuleInstance }
  | { kind: "split"; main: ModuleInstance[]; sidebar: ModuleInstance[] };

/** Inline-breaks renderes af deres vært og må ikke stå som egen række. */
export function isInlineBreak(m: ModuleInstance): boolean {
  return Boolean(getModuleDef(m.type)?.isBreak) && m.config.placement === "inline";
}

/**
 * Gruppér synlige moduler i rækker. Sammenhængende moduler med region main/sidebar bliver én to-spalte-række
 * (kun hvis begge spalter findes); alt andet står i fuld bredde i layoutets rækkefølge.
 * Ukendte modultyper og skjulte moduler udelades.
 */
export function groupByRegion(modules: readonly ModuleInstance[]): LayoutRow[] {
  const rows: LayoutRow[] = [];
  let main: ModuleInstance[] = [];
  let sidebar: ModuleInstance[] = [];
  const flush = () => {
    if (main.length && sidebar.length) rows.push({ kind: "split", main, sidebar });
    else for (const m of [...main, ...sidebar]) rows.push({ kind: "full", module: m });
    main = [];
    sidebar = [];
  };
  for (const m of modules) {
    if (!m.visible || !getModuleDef(m.type) || isInlineBreak(m)) continue;
    if (m.region === "main") main.push(m);
    else if (m.region === "sidebar") sidebar.push(m);
    else {
      flush();
      rows.push({ kind: "full", module: m });
    }
  }
  flush();
  return rows;
}

export interface BreakPoint {
  /** Break indsættes efter dette antal viste slots (1-baseret). */
  afterSlot: number;
  moduleId: string;
  occurrence: number;
}

const MAX_BREAK_OCCURRENCES = 8;

/** Hvor står break-moduler i en vært med `slotCount` viste slots? Håndterer repeatEvery. */
export function breakPlan(slotCount: number, breaks: readonly { afterSlot: number; moduleId: string; repeatEvery?: number }[] | undefined): BreakPoint[] {
  const out: BreakPoint[] = [];
  if (!breaks || slotCount < 1) return out;
  for (const b of breaks) {
    if (b.afterSlot >= 1 && b.afterSlot <= slotCount) out.push({ afterSlot: b.afterSlot, moduleId: b.moduleId, occurrence: 0 });
    if (b.repeatEvery && b.repeatEvery >= 2) {
      let n = 1;
      for (let at = b.afterSlot + b.repeatEvery; at < slotCount && n < MAX_BREAK_OCCURRENCES; at += b.repeatEvery, n++) {
        out.push({ afterSlot: at, moduleId: b.moduleId, occurrence: n });
      }
    }
  }
  return out.sort((a, c) => a.afterSlot - c.afterSlot || a.occurrence - c.occurrence);
}

export const breaksAfter = (plan: readonly BreakPoint[], shown: number) => plan.filter((p) => p.afterSlot === shown);

/** Annoncekampagne for et ad-break: hvert ad-break (og hver gentagelse) får sin egen kampagne; ingen kampagne = skjult. */
export function adIndex(modules: readonly ModuleInstance[], moduleId: string, occurrence = 0): number {
  const ads = modules.filter((m) => m.type === "ad-break");
  const pos = ads.findIndex((m) => m.id === moduleId);
  return pos < 0 ? -1 : pos + occurrence * ads.length;
}

/** Slot-placeringer sorteret efter slotIndex. */
export function sortedSlots(list: readonly SlotAssignment[] | undefined): SlotAssignment[] {
  return [...(list ?? [])].sort((a, b) => a.slotIndex - b.slotIndex);
}

/** Klokkeslæt i dansk tid uanset serverens tidszone. */
export function formatClock(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" }).format(d);
}

export function formatDayMonth(date: Date | string): { dag: string; maaned: string } {
  const d = typeof date === "string" ? new Date(date) : date;
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("da-DK", { ...o, timeZone: "Europe/Copenhagen" }).format(d);
  return { dag: f({ day: "numeric" }), maaned: f({ month: "short" }).replace(".", "").toUpperCase() };
}

/** Mærkningstekst: label fra placeringen vinder, ellers standardtekst. Aldrig tom. */
export function labelText(label: { tekst?: string } | undefined, indholdstype: string): string {
  const t = label?.tekst?.trim();
  if (t) return t;
  return indholdstype === "PR" ? "Pressemeddelelse" : indholdstype || "Uafhængig";
}

/** Titel på et modul: config.titel ellers standard. */
export function moduleTitle(m: ModuleInstance, fallback: string): string {
  return m.config.titel?.trim() || fallback;
}

export interface GridSegment {
  /** Slots [from, to) i dette segment. */
  from: number;
  to: number;
  /** Break-punkter der står umiddelbart efter segmentet. */
  breaks: BreakPoint[];
}

/** Del en liste af `count` slots i segmenter mellem break-punkter, så hver række i et grid fyldes ud (ingen huller). */
export function segmentSlots(count: number, plan: readonly BreakPoint[]): GridSegment[] {
  const cuts = [...new Set(plan.map((p) => p.afterSlot))].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const out: GridSegment[] = [];
  let from = 0;
  for (const cut of cuts) {
    if (cut > from) out.push({ from, to: cut, breaks: breaksAfter(plan, cut) });
    from = cut;
  }
  if (from < count) out.push({ from, to: count, breaks: [] });
  return out;
}

const dayKey = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(d); // YYYY-MM-DD

/** Kort tidsangivelse til lister: i dag = klokkeslæt, ellers dato ("28. sep."). Dansk tid. */
export function formatShortWhen(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (dayKey(d) === dayKey(now)) return formatClock(d);
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", timeZone: "Europe/Copenhagen" }).format(d);
}
