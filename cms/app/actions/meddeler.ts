"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { guardPublicAction } from "@/lib/ratelimit/guard";
import { generateToken, looksLikeToken } from "@/lib/validation/tokens";
import { firstIssue, meddelerFollowUpInput, meddelerRegisterInput, meddelerSagInput, meddelerTipInput } from "@/lib/validation/public";

export async function registerMeddeler(formData: {
  navn: string;
  kontakt: string;
  phone?: string;
  organisation?: string;
  kategori: string;
  omraader?: string;
  /** Honeypot — skal være tomt. */
  website?: string;
}) {
  try {
    const guard = await guardPublicAction({ action: "meddeler-register", limit: 5, windowMs: 30 * 60_000, honeypot: formData?.website, captcha: formData });
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = meddelerRegisterInput.safeParse(formData);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const input = parsed.data;
    const site = await getCurrentSite();

    const existing = await db.meddelerProfile.findFirst({ where: { instansId: site.id, kontakt: input.kontakt }, select: { id: true } });
    // Eksisterende profil: token udleveres ALDRIG til en anonym kaldende (ville give kontoovertagelse via e-mail).
    if (existing) return { success: false, error: "Der findes allerede en profil med denne e-mailadresse. Brug dit gemte personlige link." };

    const profile = await db.meddelerProfile.create({
      data: {
        token: generateToken(),
        navn: input.navn,
        kontakt: input.kontakt,
        phone: input.phone || null,
        organisation: input.organisation || null,
        kategori: input.kategori,
        omraader: input.omraader || site.kommune,
        instansId: site.id,
      },
    });

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
    const guard = await guardPublicAction({ action: "meddeler-sag", limit: 10, windowMs: 10 * 60_000 });
    if (!guard.ok) return { success: false, error: guard.error };
    if (!looksLikeToken(token)) return { success: false, error: "Meddeler-profilen blev ikke fundet." };

    const parsed = meddelerSagInput.safeParse(formData);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const input = parsed.data;

    const profile = await db.meddelerProfile.findUnique({ where: { token } });
    if (!profile || !profile.aktiv) return { success: false, error: "Meddeler-profilen blev ikke fundet." };

    const structured = {
      hvad: input.titel,
      hvor: input.sted || profile.omraader,
      hvornår: input.tidspunkt || "I dag",
      detaljer: input.tekst,
      resultat: input.resultat || null,
      meddelerKategori: input.kategori || profile.kategori,
    };

    const followUps = [
      { id: "f-1", question: "Er der billeder eller video fra begivenheden, der kan vedhæftes?" },
      { id: "f-2", question: "Er der en kilde, vi kan citere med direkte udtalelse?" },
    ];

    const sag = await db.meddelerSag.create({
      data: {
        meddelerId: profile.id,
        instansId: profile.instansId,
        titel: input.titel,
        kategori: input.kategori || profile.kategori,
        status: "Ny", // kanonisk (tidligere "Modtaget")
        tekst: input.tekst,
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
  /** Honeypot — skal være tomt. */
  website?: string;
}) {
  try {
    const guard = await guardPublicAction({ action: "meddeler-tip", limit: 8, windowMs: 30 * 60_000, honeypot: data?.website, captcha: data });
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = meddelerTipInput.safeParse(data);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const input = parsed.data;
    const site = await getCurrentSite();

    let profile: { id: string; token: string; instansId: string; kategori: string } | null = null;
    let createdNow = false;

    if (input.token && looksLikeToken(input.token)) {
      profile = await db.meddelerProfile.findUnique({ where: { token: input.token } });
    }

    if (!profile) {
      // Tip uden gyldigt token knyttes til en profil på e-mail — men afslører aldrig en eksisterende profils token.
      const existing = await db.meddelerProfile.findFirst({ where: { instansId: site.id, kontakt: input.email } });
      createdNow = !existing;
      profile =
        existing ??
        (await db.meddelerProfile.create({
          data: {
            token: generateToken(),
            navn: input.name,
            kontakt: input.email,
            phone: input.phone || null,
            organisation: input.organisation || null,
            kategori: input.category,
            omraader: input.where || site.kommune,
            instansId: site.id,
          },
        }));
    }
    const ownsProfile = Boolean(input.token && looksLikeToken(input.token));

    const tipLines = [
      `Emne/Hovedpunkt: ${input.what}`,
      input.who ? `Hvem/Organisation: ${input.who}` : null,
      input.basis ? `Kildens kendskab: ${input.basis}` : null,
      input.where ? `Sted: ${input.where}` : null,
      input.when ? `Tidspunkt: ${input.when}` : null,
      input.text ? `Uddybende oplysninger:\n${input.text}` : null,
      input.audioTranscript ? `Indtalt lydoptagelse/tale:\n${input.audioTranscript}` : null,
    ].filter(Boolean);

    const structured = {
      eventType: input.category,
      what: input.what,
      who: input.who ? [input.who] : [],
      where: input.where || "",
      when: input.when || "Ikke oplyst",
      basis: input.basis || "Ikke oplyst",
      contactOk: input.contactOk !== false,
      details: {
        what: input.what,
        who: input.who || "",
        basis: input.basis || "",
        place: input.where || "",
        when: input.when || "",
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
        titel: input.what.length > 70 ? `${input.what.slice(0, 67)}...` : input.what,
        kategori: input.category,
        status: "Ny",
        tekst: tipLines.join("\n\n"),
        billederUrl: input.photos as unknown as Prisma.InputJsonValue,
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

    // Token returneres kun til den, der enten allerede havde det eller netop oprettede profilen.
    const revealToken = ownsProfile || createdNow;
    // `existingProfile: true` fortæller UI'et, at tippet er gemt, men at brugeren skal bruge sit gemte link.
    return revealToken
      ? { success: true, token: profile.token as string | undefined, sagId: sag.id, existingProfile: false }
      : { success: true, token: undefined as string | undefined, sagId: sag.id, existingProfile: true };
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
    const guard = await guardPublicAction({ action: "meddeler-followup", limit: 20, windowMs: 10 * 60_000 });
    if (!guard.ok) return { success: false, error: guard.error };
    if (!looksLikeToken(token) || typeof sagId !== "string" || sagId.length > 64) return { success: false, error: "Meddeler-profilen blev ikke fundet." };

    const parsed = meddelerFollowUpInput.safeParse({ questionText, answerText });
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };

    const profile = await db.meddelerProfile.findUnique({ where: { token } });
    if (!profile) return { success: false, error: "Meddeler-profilen blev ikke fundet." };

    const sag = await db.meddelerSag.findUnique({ where: { id: sagId } });
    if (!sag || sag.meddelerId !== profile.id) return { success: false, error: "Sagen blev ikke fundet." };

    const answer = parsed.data.answerText;
    const question = parsed.data.questionText;
    const updatedTekst = `${sag.tekst}\n\n[SVAR PÅ SPØRGSMÅL: "${question}"]:\n${answer}`.slice(0, 60_000);

    let followUps = Array.isArray(sag.opfoelgning) ? [...(sag.opfoelgning as Array<Record<string, unknown>>)] : [];
    followUps = followUps.map((f) => (f.question === question || f.id === question ? { ...f, answered: true, answer } : f));

    await db.meddelerSag.update({
      where: { id: sagId },
      data: {
        tekst: updatedTekst,
        opfoelgning: followUps as unknown as Prisma.InputJsonValue,
        status: sag.status === "Ny" || sag.status === "Modtaget" ? "UnderBehandling" : sag.status,
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
