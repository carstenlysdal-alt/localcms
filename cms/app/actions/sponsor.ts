"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { guardPublicAction } from "@/lib/ratelimit/guard";
import { cleanText } from "@/lib/validation/text";
import { generateToken, looksLikeToken } from "@/lib/validation/tokens";
import { firstIssue, partnerReviewInput, sponsorBriefInput } from "@/lib/validation/public";
import { normalizeStatus } from "@/lib/validation/status";

export async function createSponsorBrief(formData: {
  partnerNavn: string;
  kontaktNavn: string;
  kontaktEmail: string;
  kontaktTelefon?: string;
  kampagnePeriode?: string;
  format?: string;
  formaal: string;
  budskab: string;
  citater?: string;
  fakta?: string;
  links?: string;
  /** Honeypot — skal være tomt (skjult felt i formularen). */
  website?: string;
}) {
  try {
    const guard = await guardPublicAction({ action: "sponsor-brief", limit: 5, windowMs: 30 * 60_000, honeypot: formData?.website });
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = sponsorBriefInput.safeParse(formData);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const input = parsed.data;

    const site = await getCurrentSite();

    const briefData = {
      formaal: input.formaal,
      budskab: input.budskab,
      fakta: input.fakta || "",
      links: input.links || "",
    };

    const initialQuotes = input.citater
      ? input.citater.split("\n").map((q) => q.trim()).filter((q) => q.length > 10).slice(0, 20)
      : [];

    const brief = await db.sponsorBrief.create({
      data: {
        // Nye tokens: 24 bytes CSPRNG (base64url). Eksisterende cuid-tokens virker uændret.
        token: generateToken(),
        partnerNavn: input.partnerNavn,
        kontaktNavn: input.kontaktNavn,
        kontaktEmail: input.kontaktEmail,
        kontaktTelefon: input.kontaktTelefon || null,
        kampagnePeriode: input.kampagnePeriode || "Løbende",
        format: input.format || "Sponsoreret artikel",
        status: "BriefIndsendt", // kanonisk (tidligere "BriefModtaget")
        briefData,
        citater: initialQuotes,
        reviewItems: [],
        instansId: site.id,
      },
    });

    revalidatePath("/redaktion/indbakke");
    revalidatePath("/redaktion/sponsor");

    return { success: true, token: brief.token };
  } catch (error) {
    console.error("Fejl ved oprettelse af sponsor brief:", error);
    return { success: false, error: "Der opstod en fejl ved modtagelse af briefet." };
  }
}

export async function submitPartnerReview(
  token: string,
  approval: "godkendt" | "korrektioner",
  comment?: string
) {
  try {
    const guard = await guardPublicAction({ action: "partner-review", limit: 20, windowMs: 10 * 60_000 });
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = partnerReviewInput.safeParse({ approval, comment });
    if (!parsed.success || !looksLikeToken(token)) return { success: false, error: "Ugyldig forespørgsel." };

    const brief = await db.sponsorBrief.findUnique({ where: { token } });
    if (!brief) return { success: false, error: "Partner-briefet blev ikke fundet." };

    const current = normalizeStatus("sponsor", brief.status);
    if (current === "Publiceret" || current === "ArtikelOprettet") {
      return { success: false, error: "Briefet er allerede afsluttet og kan ikke ændres." };
    }

    const reviewItems = Array.isArray(brief.reviewItems)
      ? (brief.reviewItems as Array<Record<string, unknown>>).slice(-49)
      : [];

    reviewItems.push({
      at: new Date().toISOString(),
      approval: parsed.data.approval,
      comment: cleanText(parsed.data.comment ?? "", 3000, { multiline: true }),
    });

    await db.sponsorBrief.update({
      where: { token },
      data: {
        status: parsed.data.approval === "godkendt" ? "Godkendt" : "RettelserAnmodet",
        reviewItems: reviewItems as unknown as Prisma.InputJsonValue,
      },
    });

    revalidatePath(`/partner/${token}`);
    revalidatePath("/redaktion/indbakke");
    revalidatePath("/redaktion/sponsor");

    return { success: true };
  } catch (error) {
    console.error("Fejl ved partnergodkendelse:", error);
    return { success: false, error: "Der opstod en fejl." };
  }
}
