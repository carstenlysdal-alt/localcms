"use server";

import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { revalidatePath } from "next/cache";

export async function registerMeddeler(formData: {
  navn: string;
  kontakt: string;
  phone?: string;
  organisation?: string;
  kategori: string;
  omraader?: string;
}) {
  try {
    const site = await getCurrentSite();

    // Tjek om meddeler allerede findes på e-mail
    let profile = await db.meddelerProfile.findFirst({
      where: {
        instansId: site.id,
        kontakt: formData.kontakt.trim().toLowerCase(),
      },
    });

    if (!profile) {
      profile = await db.meddelerProfile.create({
        data: {
          navn: formData.navn,
          kontakt: formData.kontakt.trim().toLowerCase(),
          phone: formData.phone || null,
          organisation: formData.organisation || null,
          kategori: formData.kategori,
          omraader: formData.omraader || site.kommune,
          instansId: site.id,
        },
      });
    }

    revalidatePath("/meddeler");
    revalidatePath("/redaktion/meddeler");

    return { success: true, token: profile.token };
  } catch (error) {
    console.error("Fejl ved registrering af meddeler:", error);
    return { success: false, error: "Der opstod en fejl under tilmeldingen." };
  }
}

export async function submitMeddelerSag(
  token: string,
  formData: {
    titel: string;
    kategori?: string;
    tekst: string;
    tidspunkt?: string;
    sted?: string;
    resultat?: string;
  }
) {
  try {
    const profile = await db.meddelerProfile.findUnique({
      where: { token },
    });

    if (!profile) {
      return { success: false, error: "Meddeler-profilen blev ikke fundet." };
    }

    // AI-strukturering simulation / data
    const structured = {
      hvad: formData.titel,
      hvor: formData.sted || profile.omraader,
      hvornår: formData.tidspunkt || "I dag",
      detaljer: formData.tekst,
      resultat: formData.resultat || null,
      meddelerKategori: formData.kategori || profile.kategori,
    };

    const followUps = [
      { id: "f-1", question: "Er der billeder eller video fra begivenheden, der kan vedhæftes?" },
      { id: "f-2", question: "Er der en kilde, vi kan citere med direkte udtalelse?" },
    ];

    const sag = await db.meddelerSag.create({
      data: {
        meddelerId: profile.id,
        instansId: profile.instansId,
        titel: formData.titel,
        kategori: formData.kategori || profile.kategori,
        status: "Modtaget",
        tekst: formData.tekst,
        struktureret: structured,
        opfoelgning: followUps,
      },
    });

    revalidatePath(`/meddeler/${token}`);
    revalidatePath("/redaktion/indbakke");
    revalidatePath("/redaktion/meddeler");

    return { success: true, sagId: sag.id };
  } catch (error) {
    console.error("Fejl ved indsendelse af meddeler-sag:", error);
    return { success: false, error: "Kunne ikke gemme indberetningen." };
  }
}
