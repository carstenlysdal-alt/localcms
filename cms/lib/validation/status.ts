/**
 * Ét kanonisk statusvokabular pr. indtagsmodel + bagudkompatible læsninger.
 *
 * Skrivning bruger ALTID de kanoniske værdier (PascalCase, dansk, ASCII).
 * Læsning går gennem `normalizeStatus`, så ældre rækker (BESVARET, GENNEMFOERT,
 * AFVENTER_SVAR, OPRETTET, BriefModtaget, Modtaget …) stadig vises korrekt.
 * Ingen datamigrering er nødvendig; `scripts`-opdatering er valgfri (se docs).
 */

export const QA_STATUS = ["Sendt", "Besvaret", "DelvistBesvaret", "ArtikelOprettet"] as const;
export const INTERVIEW_STATUS = ["Oprettet", "Sendt", "Igang", "Besvaret", "ArtikelOprettet"] as const;
export const SPONSOR_STATUS = ["Booket", "BriefIndsendt", "UdkastKlar", "Faktatjek", "RettelserAnmodet", "Godkendt", "Publiceret", "ArtikelOprettet"] as const;
export const MEDDELER_STATUS = ["Ny", "UnderBehandling", "BrugtIArtikel", "Afvist", "ArtikelOprettet"] as const;

export type StatusKind = "qa" | "interview" | "sponsor" | "meddeler";

const LEGACY: Record<StatusKind, Record<string, string>> = {
  qa: { BESVARET: "Besvaret", AFVENTER_SVAR: "Sendt", AFVENTER: "Sendt", DELVIST_BESVARET: "DelvistBesvaret", ARTIKELOPRETTET: "ArtikelOprettet" },
  interview: { OPRETTET: "Oprettet", GENNEMFOERT: "Besvaret", GENNEMFØRT: "Besvaret", IGANG: "Igang", SENDT: "Sendt", BESVARET: "Besvaret", ARTIKELOPRETTET: "ArtikelOprettet" },
  sponsor: { BRIEFMODTAGET: "BriefIndsendt", BRIEFINDSENDT: "BriefIndsendt", BOOKET: "Booket", UDKASTKLAR: "UdkastKlar", FAKTATJEK: "Faktatjek", RETTELSERANMODET: "RettelserAnmodet", GODKENDT: "Godkendt", PUBLICERET: "Publiceret", ARTIKELOPRETTET: "ArtikelOprettet" },
  meddeler: { MODTAGET: "Ny", NY: "Ny", UNDERBEHANDLING: "UnderBehandling", BRUGTIARTIKEL: "BrugtIArtikel", AFVIST: "Afvist", ARTIKELOPRETTET: "ArtikelOprettet" },
};

const CANONICAL: Record<StatusKind, readonly string[]> = {
  qa: QA_STATUS,
  interview: INTERVIEW_STATUS,
  sponsor: SPONSOR_STATUS,
  meddeler: MEDDELER_STATUS,
};

/** Returnér den kanoniske status for en (muligvis ældre) lagret værdi. Ukendt værdi returneres uændret. */
export function normalizeStatus(kind: StatusKind, value: string | null | undefined): string {
  const raw = String(value ?? "");
  if (CANONICAL[kind].includes(raw)) return raw;
  const upper = raw.toUpperCase().replace(/[\s-]+/g, "_");
  return LEGACY[kind][upper] ?? LEGACY[kind][upper.replace(/_/g, "")] ?? raw;
}

export function isAnswered(kind: "qa" | "interview", value: string | null | undefined): boolean {
  const status = normalizeStatus(kind, value);
  return status === "Besvaret" || status === "DelvistBesvaret" || status === "ArtikelOprettet";
}

/** "Ny"/åben i indbakken, uanset hvilken skrivemåde der er gemt. */
export function isNewIntakeStatus(value: string | null | undefined): boolean {
  const raw = String(value ?? "");
  if (raw === "Ny" || raw === "Modtaget") return true;
  return (
    normalizeStatus("qa", raw) === "Sendt" ||
    normalizeStatus("interview", raw) === "Oprettet" ||
    normalizeStatus("sponsor", raw) === "BriefIndsendt"
  );
}
