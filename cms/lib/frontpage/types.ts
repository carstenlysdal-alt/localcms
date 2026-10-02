/**
 * Fælles typer for T11/T12 (modulær forside + AI-forslag). Rene typer og konstanter — ingen I/O.
 * Spec: docs/review/T11-T12-spec.md
 */

/** Alle modultyper i kataloget (se modules.ts for definitionerne). */
export const MODULE_TYPE_IDS = [
  "hero",
  "top-grid",
  "breaking-bar",
  "seneste-nyt",
  "dit-omraade",
  "sektion-rail",
  "partner-break",
  "sponsoreret-break",
  "ad-break",
  "egen-promo",
  "kalender-strip",
  "fra-kommunen",
  "fra-politiet",
  "debat",
  "opslagstavle",
] as const;
export type ModuleTypeId = (typeof MODULE_TYPE_IDS)[number];

/** Visningsvarianter af ét og samme indhold (render-regler: VARIANT_RULES i modules.ts). */
export const VARIANTS = ["hero", "kort", "kompakt", "liste", "tekstlinje"] as const;
export type Variant = (typeof VARIANTS)[number];

/**
 * ÉN fælles definition af hvad der tæller som kommercielt/støttefinansieret indhold i kvoteloftet. Bruges af
 * 7-dages-kvoten (lib/frontpage-governance.ts), forsidens rækværk (lib/frontpage/guardrails.ts) og begge
 * fastgør-handlinger. Annoncekampagner (ad-break) tæller som typen "Annonce" (se adBreakAllowance i guardrails.ts).
 */
export const COMMERCIAL_TYPES: readonly string[] = ["Partner", "Sponsoreret", "PR", "Annonce"];
export const isCommercialType = (indholdstype: string) => COMMERCIAL_TYPES.includes(indholdstype);

/** Hvem satte artiklen i sloten. Matcher FrontpageDecision.kilde. */
export type AssignmentSource = "ai" | "redaktør" | "regel";

/** Kandidatartikel til forsiden — fladt, serialiserbart udtræk (ingen Prisma-typer i den rene kerne). */
export interface Candidate {
  id: string;
  instansId: string;
  titel: string;
  manchet?: string | null;
  status: string;
  publiceretTid: Date | null;
  indholdstype: string;
  breaking: boolean;
  pinned: boolean;
  sektionSlug: string;
  kategoriSlug?: string | null;
  kategoriNavn?: string | null;
  /** Emne-nøgle til diversitet i topzonen (første tag-slug, ellers kategori-slug). */
  emneKey?: string | null;
  omraadeSlug?: string | null;
  visninger: number;
  laesninger: number;
  totalLaesetidSek: number;
  /** True når lib/marking.validateMarking accepterer artiklens mærkning (kræves for alt andet end Uafhængig). */
  harMaerkning: boolean;
  /** Redaktørens synlige mærkningstekst (marking.labelTekst), hvis angivet. */
  maerkningTekst?: string | null;
}

/** Synlig mærkning. `synlig` er bevidst typet som literal true: mærkning kan aldrig slås fra. */
export interface AssignmentLabel {
  tekst: string;
  synlig: true;
}

export interface SlotAssignment {
  /** Modulinstansens id (ModuleInstance.id). */
  moduleId: string;
  slotIndex: number;
  articleId: string;
  variant: Variant;
  kilde: AssignmentSource;
  /** 1–5 (5 = vigtigst). */
  prioritet: number;
  /** Kort forklaring (<= 200 tegn) — vises som "AI-forklaring" i editoren. */
  begrundelse: string;
  konfidens: number | null;
  label: AssignmentLabel;
  /** Redaktørens låste placering (pin) — AI/ranker flytter den ikke. */
  locked: boolean;
  /** Deterministisk score (til visning i editoren). */
  score?: number;
}

export type ViolationSeverity = "blokerende" | "advarsel";

export const VIOLATION_CODES = [
  "tenant",
  "status",
  "friskhed",
  "kvoteloft",
  "ai-hero",
  "ai-begraenset",
  "diversitet",
  "dublet",
  "type-ikke-tilladt",
  "maerkning",
  "slot-ugyldigt",
  "modul-ukendt",
  "ukendt-artikel",
  "tom-slot",
  "kun-breaking",
  "pin-ikke-placeret",
  "ai-fejl",
  "layout-aendret",
] as const;
export type ViolationCode = (typeof VIOLATION_CODES)[number];

export interface Violation {
  code: ViolationCode;
  severity: ViolationSeverity;
  besked: string;
  moduleId?: string;
  slotIndex?: number;
  articleId?: string;
}

/** Redaktørens pin. Oprettes typisk ud fra FrontpagePlacement (se placementsToPins i compose.ts). */
export interface Pin {
  articleId: string;
  /** Eksplicit modulinstans; ellers første synlige modul af `moduleType`. */
  moduleId?: string;
  moduleType?: ModuleTypeId;
  slotIndex?: number;
  expiresAt?: Date | null;
}

/** AI's vurdering af ÉN kandidat (output fra ai-ranker.ts efter validering). */
export interface AiSuggestion {
  articleId: string;
  prioritet: number; // 1..5 heltal
  forslagModul: ModuleTypeId;
  begrundelse: string; // <= 200 tegn
  konfidens: number; // 0..1
}

export type SnapshotStatus = "forslag" | "godkendt" | "afvist" | "udløbet";
export type SnapshotMode = "forslag" | "auto";
export type SnapshotGeneratedBy = "deterministic" | "ai";

/** Hvad der står i FrontpageSnapshot.items (Json). */
export interface SnapshotItems {
  schemaVersion: 1;
  /** Layoutets version da forslaget blev lavet (0 = standardlayout, ikke gemt). */
  layoutVersion: number;
  assignments: SlotAssignment[];
  warnings: Violation[];
}

export interface QuotaInput {
  kvoteloftProcent: number;
  /** True når 7-dages-andelen af støttefinansieret indhold har nået loftet (lib/frontpage-governance). */
  isExceeded: boolean;
}

export type FrontpageSource = "godkendt-snapshot" | "deterministisk" | "seneste-nyt";
