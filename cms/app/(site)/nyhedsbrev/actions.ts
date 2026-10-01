"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { revalidatePath } from "next/cache";

const subscribeSchema = z.object({
  email: z.string().trim().email("Indtast venligst en gyldig e-mailadresse."),
  navn: z.string().trim().optional().nullable(),
  omraadeSlug: z.string().trim().optional().nullable(),
  sektionSlug: z.string().trim().optional().nullable(),
  samtykke: z.boolean().refine((v) => v === true, {
    message: "Du skal acceptere betingelserne for at modtage nyhedsbrevet.",
  }),
});

export type SubscribeActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function subscribeToNewsletter(
  prevState: SubscribeActionResult | null,
  formData: FormData
): Promise<SubscribeActionResult> {
  try {
    const rawData = {
      email: formData.get("email")?.toString() || "",
      navn: formData.get("navn")?.toString() || null,
      omraadeSlug: formData.get("omraadeSlug")?.toString() || null,
      sektionSlug: formData.get("sektionSlug")?.toString() || null,
      samtykke: formData.get("samtykke") === "on" || formData.get("samtykke") === "true",
    };

    const parsed = subscribeSchema.safeParse(rawData);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0]?.message || "Udfyld venligst de påkrævede felter.";
      return { success: false, error: firstErr };
    }

    const { email, navn, omraadeSlug, sektionSlug } = parsed.data;
    const site = await getCurrentSite();

    const existing = await db.newsletterSubscriber.findFirst({
      where: { instansId: site.id, email: email.toLowerCase() },
    });

    if (existing) {
      if (existing.aktiv) {
        return {
          success: true,
          message: `Du er allerede tilmeldt ${site.navn}s nyhedsbrev med adressen ${email}.`,
        };
      } else {
        await db.newsletterSubscriber.update({
          where: { id: existing.id },
          data: {
            aktiv: true,
            afmeldtTid: null,
            bekraeftetTid: new Date(),
            navn: navn || existing.navn,
            omraadeSlug: omraadeSlug || existing.omraadeSlug,
            sektionSlug: sektionSlug || existing.sektionSlug,
          },
        });

        revalidatePath("/redaktion/nyhedsbrev");
        return {
          success: true,
          message: `Velkommen tilbage! Vi har genaktiveret din tilmelding til ${site.navn}.`,
        };
      }
    }

    await db.newsletterSubscriber.create({
      data: {
        email: email.toLowerCase(),
        navn: navn || null,
        omraadeSlug: omraadeSlug || null,
        sektionSlug: sektionSlug || null,
        aktiv: true,
        bekraeftetTid: new Date(),
        instansId: site.id,
      },
    });

    revalidatePath("/redaktion/nyhedsbrev");

    return {
      success: true,
      message: `Tak for din tilmelding! Vi sender det vigtigste lokale overblik direkte til ${email}.`,
    };
  } catch (error) {
    console.error("Fejl ved nyhedsbrevstilmelding:", error);
    return {
      success: false,
      error: "Der opstod en fejl ved tilmeldingen. Prøv venligst igen senere.",
    };
  }
}
