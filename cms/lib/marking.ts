import { z } from "zod";

export const CONTENT_TYPES = [
  "Uafhængig",
  "Partner",
  "Sponsoreret",
  "Brugerindsendt",
  "AI-assisteret",
  "PR",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const partnerMarkingSchema = z.object({
  sponsor: z.string().trim().min(2, "Angiv sponsor eller partner."),
  labelTekst: z.string().trim().min(2, "Angiv den synlige mærkningstekst."),
  // Obligatorisk (governance.md §1): partnerindhold uden støtteaftale kan ikke publiceres.
  aftaleId: z.string({ error: "Angiv aftaleId for partnerindhold." }).trim().min(1, "Angiv aftaleId for partnerindhold."),
});

export const sponsorMarkingSchema = z.object({
  sponsor: z.string().trim().min(2, "Angiv sponsor eller partner."),
  labelTekst: z.string().trim().min(2, "Angiv den synlige mærkningstekst."),
});

export const userSubmissionMarkingSchema = z.object({
  afsender: z.string().trim().min(2, "Angiv afsender for indsendt materiale."),
});

export const prMarkingSchema = z.object({
  afsender: z.string().trim().min(2, "Angiv afsender for pressemeddelelse."),
});

export const aiMarkingSchema = z.object({
  // Sættes server-side til den godkendende (publicerende) bruger — se artikler/actions.ts. Aldrig fri tekst fra formularen.
  godkendtAf: z.string().trim().min(2, "Angiv hvem der har godkendt det AI-assisterede indhold."),
  godkendtAfUserId: z.string().trim().min(1).optional(),
  kilder: z.array(z.string().trim().min(1, "Kilde kan ikke være tom.")).min(1, "Angiv mindst én kilde-URL eller reference."),
});

export type PartnerMarking = z.infer<typeof partnerMarkingSchema>;
export type SponsorMarking = z.infer<typeof sponsorMarkingSchema>;
export type UserSubmissionMarking = z.infer<typeof userSubmissionMarkingSchema>;
export type PRMarking = z.infer<typeof prMarkingSchema>;
export type AIMarking = z.infer<typeof aiMarkingSchema>;

export type Marking =
  | PartnerMarking
  | SponsorMarking
  | UserSubmissionMarking
  | PRMarking
  | AIMarking;

export function validateMarking(indholdstype: string, marking: unknown): { success: true; data: Marking | null } | { success: false; error: string } {
  if (indholdstype === "Uafhængig") {
    return { success: true, data: null };
  }
  if (indholdstype === "Partner") {
    const res = partnerMarkingSchema.safeParse(marking);
    if (!res.success) {
      return { success: false, error: "Partnerindhold kan ikke publiceres uden sponsor, tydelig mærkning og aftaleId." };
    }
    return { success: true, data: res.data };
  }
  if (indholdstype === "Sponsoreret") {
    const res = sponsorMarkingSchema.safeParse(marking);
    if (!res.success) {
      return { success: false, error: "Sponsoreret indhold kan ikke publiceres uden sponsor og tydelig mærkning." };
    }
    return { success: true, data: res.data };
  }
  if (indholdstype === "Brugerindsendt") {
    const res = userSubmissionMarkingSchema.safeParse(marking);
    if (!res.success) {
      return { success: false, error: "Brugerindsendt materiale kan ikke publiceres uden afsender." };
    }
    return { success: true, data: res.data };
  }
  if (indholdstype === "PR") {
    const res = prMarkingSchema.safeParse(marking);
    if (!res.success) {
      return { success: false, error: "Pressemeddelelser kan ikke publiceres uden afsender." };
    }
    return { success: true, data: res.data };
  }
  if (indholdstype === "AI-assisteret") {
    const res = aiMarkingSchema.safeParse(marking);
    if (!res.success) {
      return { success: false, error: "AI-assisteret indhold kan ikke publiceres uden godkendelse og kildehenvisninger." };
    }
    return { success: true, data: res.data };
  }
  return { success: false, error: `Ukendt indholdstype: ${indholdstype}` };
}

export function assertPublishableMarking(indholdstype: string, marking: unknown) {
  const result = validateMarking(indholdstype, marking);
  if (!result.success) throw new Error(result.error);
}

/** De fire AI-brugsværdier + det eksplicitte valg "Ingen" (artikel uden AI-brug). Delt af editor og agent-indtag. */
export const AI_USAGE_VALUES = ["Sproglig korrektur", "Omskrivning", "Transskribering", "Udkast"] as const;
export const AI_USE_NONE = "Ingen" as const;
/** AI-brug der indebærer, at AI har formuleret tekst — forbudt i spærrede kategorier uanset indholdstype (T5 P2-7). */
export const AI_TEXT_GENERATING_USES: readonly string[] = ["Omskrivning", "Udkast"];

export type AiUseResult = { ok: true; value: string[] } | { ok: false; error: string };

/**
 * Validerer redaktørens AI-brug-valg. Der skal være taget et AKTIVT valg: enten "Ingen" (ingen AI brugt) eller
 * mindst én konkret brug. "Ingen" kan ikke kombineres med andet. Tom liste er gyldig som kladde (ikke taget stilling),
 * men kan ikke publiceres (`requireChoice`).
 */
export function normalizeAiUse(raw: readonly string[], opts: { requireChoice: boolean }): AiUseResult {
  const unique = Array.from(new Set(raw.map((v) => v.trim()).filter(Boolean)));
  const allowed: readonly string[] = [...AI_USAGE_VALUES, AI_USE_NONE];
  const unknown = unique.filter((v) => !allowed.includes(v));
  if (unknown.length) return { ok: false, error: `Ukendt AI-brug: ${unknown.join(", ")}.` };
  if (unique.includes(AI_USE_NONE) && unique.length > 1) {
    return { ok: false, error: "Vælg enten 'Ingen AI brugt' eller konkret AI-brug — ikke begge dele." };
  }
  if (unique.length === 0 && opts.requireChoice) {
    return { ok: false, error: "AI-brug skal registreres før publicering: vælg konkret brug eller 'Ingen AI brugt'." };
  }
  return { ok: true, value: unique };
}

/** true hvis registreringen angiver at AI faktisk er brugt (alt andet end tom/"Ingen"). */
export function usesAi(aiBrug: unknown): boolean {
  return Array.isArray(aiBrug) && aiBrug.some((v) => typeof v === "string" && v !== AI_USE_NONE && v.trim() !== "");
}

/** Reserverede sluggs for sektioner med AI-spærring (Krimi og retsvæsen, 112, Sundhed). */
export const AI_RESTRICTED_SLUGS: readonly string[] = ["krimi-og-retsvaesen", "112", "sundhed"];

/**
 * AI-assisteret indhold må ikke ligge i Krimi og retsvæsen eller Sundhed uden journalistisk gennemskrivning.
 * Delt regel for redaktørens editor (artikler/actions.ts), forsiderækværk og agent-indtaget (lib/ingest).
 * Matcher på slug eller navn for ÉN kategori; brug `isAiRestrictedCategoryTree` når forældrene også skal med.
 */
export function isAiRestrictedCategory(category: { slug?: string | null; navn?: string | null } | null | undefined): boolean {
  if (!category) return false;
  const slug = (category.slug ?? "").toLowerCase();
  const navn = (category.navn ?? "").toLowerCase();
  return AI_RESTRICTED_SLUGS.includes(slug) || navn.includes("krimi") || navn.includes("sundhed") || navn.trim() === "112";
}

export type CategoryNode = { slug?: string | null; navn?: string | null; parent?: CategoryNode | null };

/**
 * Som isAiRestrictedCategory, men går hele forældrekæden igennem (barn af Krimi/Sundhed er også spærret).
 * Kæden er cyklus-sikret og begrænset til 10 niveauer.
 */
export function isAiRestrictedCategoryTree(category: CategoryNode | null | undefined): boolean {
  let node = category ?? null;
  for (let depth = 0; node && depth < 10; depth++) {
    if (isAiRestrictedCategory(node)) return true;
    node = node.parent ?? null;
  }
  return false;
}
