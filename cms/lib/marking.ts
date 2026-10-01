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
  aftaleId: z.string().trim().min(1, "Angiv aftaleId for partnerindhold.").optional(),
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
  godkendtAf: z.string().trim().min(2, "Angiv hvem der har godkendt det AI-assisterede indhold."),
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
      return { success: false, error: "Partnerindhold kan ikke publiceres uden sponsor og tydelig mærkning." };
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

/**
 * AI-assisteret indhold må ikke ligge i Krimi og retsvæsen eller Sundhed uden journalistisk gennemskrivning.
 * Delt regel for redaktørens editor (artikler/actions.ts) og agent-indtaget (lib/ingest).
 */
export function isAiRestrictedCategory(category: { slug?: string | null; navn?: string | null } | null | undefined): boolean {
  if (!category) return false;
  const slug = (category.slug ?? "").toLowerCase();
  const navn = (category.navn ?? "").toLowerCase();
  return slug === "krimi-og-retsvaesen" || slug === "sundhed" || navn.includes("krimi") || navn.includes("sundhed");
}
