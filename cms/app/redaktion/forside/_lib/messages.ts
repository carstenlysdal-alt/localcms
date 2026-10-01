/**
 * Danske meddelelser til servicekoder, AI-fejl og forslagsresultater. Rent og testbart.
 * Servicekoder: forbidden | not-found | conflict | invalid | layout-aendret | guardrails | no-candidates | rate-limited | ai-unavailable | fejl
 */
export const SERVICE_CODES = ["forbidden", "not-found", "conflict", "invalid", "layout-aendret", "guardrails", "no-candidates", "rate-limited", "ai-unavailable", "fejl"] as const;
export type ServiceCode = (typeof SERVICE_CODES)[number];

const MESSAGES: Record<ServiceCode, string> = {
  forbidden: "Du har ikke rettighed til denne handling.",
  "not-found": "Det findes ikke (længere). Genindlæs siden og prøv igen.",
  conflict: "Ændret af en anden, mens du arbejdede. Genindlæs for at se den nyeste version.",
  invalid: "Indholdet er ugyldigt. Ret fejlene og prøv igen.",
  "layout-aendret": "Layoutet er ændret siden forslaget blev lavet. Opret et nyt forslag.",
  guardrails: "Rækværkene (kvoteloft, mærkning, AI-regler, friskhed) tillader ikke ændringen.",
  "no-candidates": "Der er ingen publicerede artikler at ranke endnu.",
  "rate-limited": "For mange forsøg på kort tid. Vent et par minutter og prøv igen.",
  "ai-unavailable": "AI er ikke tilgængelig lige nu. Forsiden kan stadig redigeres uden AI.",
  fejl: "Noget gik galt. Prøv igen om lidt.",
};

export function isServiceCode(code: unknown): code is ServiceCode {
  return typeof code === "string" && (SERVICE_CODES as readonly string[]).includes(code);
}

/** Dansk besked for en servicekode. Ukendt kode -> generisk fejl (aldrig rå serverfejl til brugeren). */
export function serviceErrorMessage(code: unknown): string {
  return isServiceCode(code) ? MESSAGES[code] : MESSAGES.fejl;
}

const AI_FAILURES: Record<string, string> = {
  "ingen-noegle": "AI er ikke sat op på dette miljø (API-nøgle mangler).",
  timeout: "AI svarede ikke i tide.",
  "ugyldig-json": "AI gav et svar, der ikke kunne læses.",
  schema: "AI's svar levede ikke op til det forventede format.",
  "api-fejl": "AI-tjenesten gav en fejl.",
  "tomt-svar": "AI gav et tomt svar.",
  "tom-kommando": "Skriv først, hvad AI skal hjælpe med.",
};

export function aiFailureMessage(reason: string | null | undefined): string {
  return (reason && AI_FAILURES[reason]) || "AI var utilgængelig.";
}

export type Tone = "ok" | "info" | "warn" | "error";
export interface Msg {
  tone: Tone;
  text: string;
}

/** Besked efter "Foreslå forside". */
export function proposalResultMessage(res: { reused: boolean; generatedBy: "ai" | "deterministic"; aiFailure: { reason: string } | null; assignmentCount: number; wantedAi: boolean }): Msg {
  if (res.reused) return { tone: "info", text: "Der findes allerede et forslag med uændret input – det er åbnet i stedet for at oprette et nyt." };
  if (res.aiFailure) {
    return { tone: "warn", text: `${aiFailureMessage(res.aiFailure.reason)} Forslaget er lavet med almindelig rangering (uden AI). ${res.assignmentCount} placeringer.` };
  }
  if (res.generatedBy === "ai") return { tone: "ok", text: `Nyt forslag med AI-rangering (${res.assignmentCount} placeringer). Intet er live, før du godkender.` };
  return { tone: "ok", text: `Nyt forslag med almindelig rangering${res.wantedAi ? "" : " (AI fravalgt)"} – ${res.assignmentCount} placeringer. Intet er live, før du godkender.` };
}

export const PUBLISH_NOTICE =
  "Layoutet er publiceret. Den hidtidige godkendelse hører til den gamle layoutversion og er derfor nulstillet: forsiden bruger almindelig rangering, indtil du har godkendt et nyt forslag.";
