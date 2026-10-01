"use server";

import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { revalidatePath } from "next/cache";

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
}) {
  try {
    const site = await getCurrentSite();

    const briefData = {
      formaal: formData.formaal,
      budskab: formData.budskab,
      fakta: formData.fakta || "",
      links: formData.links || "",
    };

    const initialQuotes = formData.citater
      ? formData.citater.split("\n").filter((q) => q.trim().length > 10)
      : [];

    const brief = await db.sponsorBrief.create({
      data: {
        partnerNavn: formData.partnerNavn,
        kontaktNavn: formData.kontaktNavn,
        kontaktEmail: formData.kontaktEmail,
        kontaktTelefon: formData.kontaktTelefon || null,
        kampagnePeriode: formData.kampagnePeriode || "Løbende",
        format: formData.format || "Sponsoreret artikel",
        status: "BriefModtaget",
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
    const brief = await db.sponsorBrief.findUnique({
      where: { token },
    });

    if (!brief) {
      return { success: false, error: "Partner-briefet blev ikke fundet." };
    }

    const reviewItems = Array.isArray(brief.reviewItems)
      ? (brief.reviewItems as Array<Record<string, unknown>>)
      : [];

    reviewItems.push({
      at: new Date().toISOString(),
      approval,
      comment: comment || "",
    });

    await db.sponsorBrief.update({
      where: { token },
      data: {
        status: approval === "godkendt" ? "Godkendt" : "RettelserAnmodet",
        reviewItems: reviewItems as unknown as import("@prisma/client").Prisma.InputJsonValue,
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
