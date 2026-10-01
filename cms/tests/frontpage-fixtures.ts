import type { Candidate } from "../lib/frontpage/types";
import { parseModules, type ModuleInstance } from "../lib/frontpage/layout-schema";

/** Faste tidspunkter/klokkeslæt gør ranker-tests deterministiske (kl. 12 København, ingen daypart for 'nyheder'). */
export const NOW = new Date("2026-10-01T10:00:00Z");
export const HOUR = 12;
export const INST = "inst-a";

let seq = 0;
export function cand(over: Partial<Candidate> = {}): Candidate {
  seq++;
  const visninger = over.visninger ?? 100;
  const laesninger = over.laesninger ?? Math.round(visninger * 0.4);
  return {
    id: over.id ?? `art-${String(seq).padStart(4, "0")}`,
    instansId: INST,
    titel: `Artikel ${seq}`,
    manchet: null,
    status: "Publiceret",
    publiceretTid: new Date(NOW.getTime() - 3_600_000),
    indholdstype: "Uafhængig",
    breaking: false,
    pinned: false,
    sektionSlug: "nyheder",
    kategoriSlug: "politik",
    kategoriNavn: "Politik",
    emneKey: `emne-${seq}`,
    omraadeSlug: null,
    visninger,
    laesninger,
    totalLaesetidSek: over.totalLaesetidSek ?? laesninger * 60,
    harMaerkning: true,
    maerkningTekst: null,
    ...over,
  };
}

export const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

export function layout(spec: Array<[string, string, Partial<ModuleInstance>?]>): ModuleInstance[] {
  const raw = spec.map(([id, type, over]) => ({ id, type, slots: undefined as number | undefined, ...(over ?? {}) }));
  const defaults: Record<string, number> = { hero: 1, "top-grid": 3, "breaking-bar": 1, "seneste-nyt": 8, "dit-omraade": 3, "sektion-rail": 4, "partner-break": 1, "sponsoreret-break": 1, debat: 3 };
  const res = parseModules(raw.map((m) => ({ ...m, slots: m.slots ?? defaults[m.type] ?? 3 })));
  if (!res.ok) throw new Error(`Testlayout ugyldigt: ${res.errors.join("; ")}`);
  return res.value;
}

export const QUOTA_OK = { kvoteloftProcent: 25, isExceeded: false };
export const QUOTA_EXCEEDED = { kvoteloftProcent: 25, isExceeded: true };
