"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { revalidatePath } from "next/cache";
import { guardPublicAction } from "@/lib/ratelimit/guard";
import { contactSchema, longText, plain } from "@/lib/validation/public";
import { isSafePublicUrl } from "@/lib/validation/text";

const submissionSchema = z.object({
  navn: plain(120, 2).refine((v) => v.length >= 2, "Angiv venligst dit navn (mindst 2 tegn)."),
  kontakt: contactSchema,
  emne: plain(200, 3),
  tekst: longText(10_000, 10),
  omraadeId: z.string().max(64).optional().nullable(),
  billeder: z.string().max(4000).optional().nullable(),
  rettigheder: z.boolean().refine((v) => v === true, {
    message: "Du skal bekræfte rettighederne til det indsendte materiale.",
  }),
  samtykke: z.boolean().refine((v) => v === true, {
    message: "Du skal give samtykke til redaktionel behandling.",
  }),
});

export type SubmissionActionResult =
  | { success: true; submissionId: string; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function submitCitizenProposal(
  prevState: SubmissionActionResult | null,
  formData: FormData
): Promise<SubmissionActionResult> {
  try {
    // 1. Spamværn: honeypot (skjult felt) + rate limit pr. IP (5 indsendelser / 30 min)
    const guard = await guardPublicAction({
      action: "indsend",
      limit: 5,
      windowMs: 30 * 60_000,
      honeypot: formData.get("_hp_website")?.toString(),
      captcha: formData,
    });
    if (!guard.ok) return { success: false, error: guard.error };

    // 2. Valider input
    const rawData = {
      navn: formData.get("navn")?.toString() || "",
      kontakt: formData.get("kontakt")?.toString() || "",
      emne: formData.get("emne")?.toString() || "",
      tekst: formData.get("tekst")?.toString() || "",
      omraadeId: formData.get("omraadeId")?.toString() || null,
      billeder: formData.get("billeder")?.toString() || null,
      rettigheder: formData.get("rettigheder") === "on" || formData.get("rettigheder") === "true",
      samtykke: formData.get("samtykke") === "on" || formData.get("samtykke") === "true",
    };

    const parsed = submissionSchema.safeParse(rawData);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstError = Object.values(fieldErrors)[0]?.[0] || "Udfyld venligst de påkrævede felter.";
      return { success: false, error: firstError, fieldErrors };
    }

    const { navn, kontakt, emne, tekst, omraadeId, billeder, rettigheder, samtykke } = parsed.data;

    // 4. Find nuværende site
    const site = await getCurrentSite();

    // Valider evt. område
    let validOmraadeId: string | null = null;
    if (omraadeId && omraadeId !== "intet") {
      const geo = await db.geoTag.findFirst({
        where: { id: omraadeId, instansId: site.id },
      });
      if (geo) {
        validOmraadeId = geo.id;
      }
    }

    // Parser billeder hvis angivet (links/URL'er opdelt med komma eller linjeskift)
    let billederArray: string[] = [];
    if (billeder && billeder.trim().length > 0) {
      billederArray = billeder
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => isSafePublicUrl(s))
        .slice(0, 10);
    }

    // 5. Gem i databasen som "Ny" i indbakken
    const submission = await db.submission.create({
      data: {
        navn,
        kontakt,
        emne,
        tekst,
        omraadeId: validOmraadeId,
        billederUrl: billederArray.length > 0 ? billederArray : undefined,
        rettighederAccepteret: Boolean(rettigheder),
        samtykkeAccepteret: Boolean(samtykke),
        status: "Ny",
        instansId: site.id,
      },
    });

    // Revalider redaktionel indbakke
    revalidatePath("/redaktion/indbakke");

    return {
      success: true,
      submissionId: submission.id,
      message: "Mange tak for dit bidrag! Redaktionen gennemgår dit tip snarest muligt.",
    };
  } catch (error) {
    console.error("Fejl ved indsendelse af borgerforslag:", error);
    return {
      success: false,
      error: "Der opstod en uventet serverfejl ved indsendelsen. Prøv venligst igen senere.",
    };
  }
}
