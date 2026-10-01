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

export async function submitMeddelerTip(data: {
  token?: string;
  category: "tip" | "haendelse" | "arrangement" | "sport" | "andet";
  name: string;
  email: string;
  phone?: string;
  organisation?: string;
  what: string;
  who?: string;
  basis?: string;
  where?: string;
  when?: string;
  text?: string;
  audioTranscript?: string;
  photos?: Array<{ name: string; url?: string; credit: string }>;
  contactOk?: boolean;
  consent: boolean;
}) {
  try {
    const site = await getCurrentSite();

    let profile: { id: string; token: string; instansId: string; kategori: string } | null = null;

    if (data.token) {
      profile = await db.meddelerProfile.findUnique({
        where: { token: data.token },
      });
    }

    if (!profile) {
      const cleanEmail = data.email.trim().toLowerCase();
      profile = await db.meddelerProfile.findFirst({
        where: { instansId: site.id, kontakt: cleanEmail },
      });

      if (!profile) {
        profile = await db.meddelerProfile.create({
          data: {
            navn: data.name.trim(),
            kontakt: cleanEmail,
            phone: data.phone?.trim() || null,
            organisation: data.organisation?.trim() || null,
            kategori: data.category,
            omraader: data.where?.trim() || site.kommune,
            instansId: site.id,
          },
        });
      }
    }

    const tipLines = [
      `Emne/Hovedpunkt: ${data.what}`,
      data.who ? `Hvem/Organisation: ${data.who}` : null,
      data.basis ? `Kildens kendskab: ${data.basis}` : null,
      data.where ? `Sted: ${data.where}` : null,
      data.when ? `Tidspunkt: ${data.when}` : null,
      data.text ? `Uddybende oplysninger:\n${data.text}` : null,
      data.audioTranscript ? `Indtalt lydoptagelse/tale:\n${data.audioTranscript}` : null,
    ].filter(Boolean);

    const fullText = tipLines.join("\n\n");

    const structured = {
      eventType: data.category,
      what: data.what,
      who: data.who ? [data.who] : [],
      where: data.where || "",
      when: data.when || "Ikke oplyst",
      basis: data.basis || "Ikke oplyst",
      contactOk: data.contactOk !== false,
      details: {
        what: data.what,
        who: data.who || "",
        basis: data.basis || "",
        place: data.where || "",
        when: data.when || "",
      },
    };

    const followUps = [
      { id: "f-1", question: "Er der dokumentation, billeder eller dokumenter, vi kan efterprøve?" },
      { id: "f-2", question: "Er der andre personer med kendskab til dette, vi bør kontakte?" },
    ];

    const sag = await db.meddelerSag.create({
      data: {
        meddelerId: profile.id,
        instansId: profile.instansId,
        titel: data.what.length > 70 ? `${data.what.slice(0, 67)}...` : data.what,
        kategori: data.category,
        status: "Ny",
        tekst: fullText,
        billederUrl: data.photos || [],
        aiStruktureret: structured,
        struktureret: structured,
        opfoelgendeSpm: followUps,
        opfoelgning: followUps,
      },
    });

    revalidatePath(`/meddeler/${profile.token}`);
    revalidatePath("/meddeler");
    revalidatePath("/redaktion/indbakke");
    revalidatePath("/redaktion/meddeler");

    return { success: true, token: profile.token, sagId: sag.id };
  } catch (error) {
    console.error("Fejl ved indsendelse af tip:", error);
    return { success: false, error: "Der opstod en fejl ved modtagelse af dit tip." };
  }
}

export async function answerMeddelerFollowUp(
  token: string,
  sagId: string,
  questionText: string,
  answerText: string
) {
  try {
    const profile = await db.meddelerProfile.findUnique({
      where: { token },
    });

    if (!profile) {
      return { success: false, error: "Meddeler-profilen blev ikke fundet." };
    }

    const sag = await db.meddelerSag.findUnique({
      where: { id: sagId },
    });

    if (!sag || sag.meddelerId !== profile.id) {
      return { success: false, error: "Sagen blev ikke fundet." };
    }

    // Tilføj svar til sagens tekst
    const updatedTekst = `${sag.tekst}\n\n[SVAR PÅ SPØRGSMÅL: "${questionText}"]:\n${answerText.trim()}`;

    // Opdater opfølgningsstatus i JSON
    let followUps = Array.isArray(sag.opfoelgning) ? [...(sag.opfoelgning as Array<any>)] : [];
    followUps = followUps.map((f) => {
      if (f.question === questionText || f.id === questionText) {
        return { ...f, answered: true, answer: answerText.trim() };
      }
      return f;
    });

    await db.meddelerSag.update({
      where: { id: sagId },
      data: {
        tekst: updatedTekst,
        opfoelgning: followUps,
        status: sag.status === "Ny" ? "UnderBehandling" : sag.status,
      },
    });

    revalidatePath(`/meddeler/${token}`);
    revalidatePath("/redaktion/indbakke");
    revalidatePath("/redaktion/meddeler");

    return { success: true };
  } catch (error) {
    console.error("Fejl ved besvarelse af opfølgende spørgsmål:", error);
    return { success: false, error: "Kunne ikke gemme dit svar." };
  }
}

