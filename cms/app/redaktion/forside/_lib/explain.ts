import type { SlotAssignment } from "@/lib/frontpage/types";

/** "Hvorfor står den her?" – forklaring af én placering ud fra de data backend allerede har gemt. Rent. */
export function explainAssignment(a: SlotAssignment, opts: { moduleLabel?: string } = {}): string[] {
  const lines: string[] = [];
  const kilde = a.kilde === "ai" ? "AI-ranker (forslag, godkendt af en redaktør)" : a.kilde === "redaktør" ? "Valgt/fastgjort af en redaktør" : "Almindelig rangering (regelbaseret score)";
  lines.push(`Placeret af: ${kilde}.`);
  if (a.locked) lines.push("Låst: AI og rangering flytter den ikke (fastgjort af redaktør).");
  lines.push(`Prioritet ${a.prioritet} af 5${a.score !== undefined ? ` · score ${a.score.toFixed(1)}` : ""}${a.konfidens !== null ? ` · AI-konfidens ${Math.round(a.konfidens * 100)} %` : ""}.`);
  if (a.begrundelse.trim()) lines.push(`Begrundelse: ${a.begrundelse.trim()}`);
  lines.push(`Mærkning på forsiden: "${a.label.tekst}" (kan ikke slås fra).`);
  if (opts.moduleLabel) lines.push(`Vises i ${opts.moduleLabel}, slot ${a.slotIndex + 1}, som ${a.variant}.`);
  return lines;
}

export const KILDE_LABEL: Record<string, string> = { ai: "AI", regel: "Regel", redaktør: "Redaktør" };
