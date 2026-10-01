import type { ModuleInstance } from "@/lib/frontpage/layout-schema";
import { MODULE_REGISTRY } from "@/lib/frontpage/modules";
import type { Violation, ViolationCode } from "@/lib/frontpage/types";

/** Overskrifter til rækværks-advarsler (kode -> kort dansk titel). */
export const VIOLATION_TITLE: Record<ViolationCode, string> = {
  tenant: "Fremmed instans",
  status: "Ikke publiceret",
  friskhed: "For gammel artikel",
  kvoteloft: "Kvoteloft",
  "ai-hero": "AI-assisteret i hero",
  "ai-begraenset": "AI-assisteret i Krimi/Sundhed",
  diversitet: "Samme emne flere gange i toppen",
  dublet: "Artikel vist flere gange",
  "type-ikke-tilladt": "Indholdstype ikke tilladt her",
  maerkning: "Mærkning mangler",
  "slot-ugyldigt": "Ugyldigt slot",
  "modul-ukendt": "Ukendt modul",
  "ukendt-artikel": "Ukendt artikel",
  "tom-slot": "Tomt slot",
  "kun-breaking": "Kun breaking-artikler",
  "pin-ikke-placeret": "Fastgjort artikel kunne ikke placeres",
  "ai-fejl": "AI var utilgængelig",
  "layout-aendret": "Layoutet er ændret",
};

export const violationTitle = (v: Pick<Violation, "code">) => VIOLATION_TITLE[v.code] ?? v.code;

/** Grupperinger til advarselspanelet (spec: kvoteloft, diversitet, mangler mærkning, tomme slots, AI-assisteret i hero). */
export function groupViolations(vs: readonly Violation[]) {
  return {
    blokerende: vs.filter((v) => v.severity === "blokerende"),
    advarsler: vs.filter((v) => v.severity === "advarsel"),
  };
}

/** Lokale layout-hints, der ikke kræver serveren. */
export function layoutHints(modules: readonly ModuleInstance[]): string[] {
  const out: string[] = [];
  const visible = modules.filter((m) => m.visible);
  if (!visible.some((m) => m.type === "hero")) out.push("Layoutet har ingen synlig hero. Forsiden får så ikke en tophistorie.");
  if (!visible.some((m) => m.type === "seneste-nyt")) out.push("Layoutet har ikke Seneste nyt. Det er forsidens kronologiske fallback, og anbefales altid.");
  if (modules.some((m) => !m.visible)) out.push(`${modules.filter((m) => !m.visible).length} modul(er) er skjult og vises ikke for besøgende.`);
  const autos = modules.filter((m) => m.mode === "auto");
  if (autos.length) out.push(`${autos.length} modul(er) er sat til Auto. Auto er endnu ikke aktivt: forsiden kræver stadig din godkendelse.`);
  const police = visible.find((m) => m.type === "fra-politiet");
  if (police) out.push("Fra politiet viser maskinindsamlede meldinger uden redaktionel gennemgang. Overvej om modulet skal være synligt (åbent spørgsmål i specen).");
  const emptyBreaks = modules.filter((m) => MODULE_REGISTRY[m.type]?.isBreak && m.config.placement === "sequence" && !m.visible);
  void emptyBreaks;
  return out;
}

/**
 * Mange "tomt slot"-advarsler fylder meget: saml dem til én pr. modul ("Seneste nyt: 7 tomme slots (2–8)").
 * Øvrige advarsler bevares uændret og i rækkefølge.
 */
export function collapseEmptySlots(vs: readonly Violation[], nameOf: (moduleId: string) => string = (id) => id): Violation[] {
  const empties = new Map<string, number[]>();
  const rest: Violation[] = [];
  for (const v of vs) {
    if (v.code === "tom-slot" && v.moduleId && v.slotIndex !== undefined) {
      const list = empties.get(v.moduleId) ?? [];
      list.push(v.slotIndex);
      empties.set(v.moduleId, list);
    } else rest.push(v);
  }
  const grouped: Violation[] = [...empties.entries()].map(([moduleId, idx]) => {
    const sorted = [...idx].sort((a, b) => a - b).map((i) => i + 1);
    const range = sorted.length > 1 && sorted[sorted.length - 1] - sorted[0] === sorted.length - 1 ? `${sorted[0]}–${sorted[sorted.length - 1]}` : sorted.join(", ");
    return { code: "tom-slot", severity: "advarsel", moduleId, besked: `${nameOf(moduleId)}: ${sorted.length} ${sorted.length === 1 ? "tomt slot" : "tomme slots"} (slot ${range}). Der er ikke flere passende artikler til dem.` };
  });
  return [...rest, ...grouped];
}
