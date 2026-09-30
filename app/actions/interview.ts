"use server";

import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { revalidatePath } from "next/cache";

export async function submitInterviewAnswers(
  token: string,
  answers: Record<string, { text: string; audioUrl?: string }>,
  finalComment?: string
) {
  try {
    const session = await db.interviewSession.findUnique({
      where: { token },
    });

    if (!session) {
      return { success: false, error: "Interviewet blev ikke fundet." };
    }

    const quotes: string[] = [];
    const transcriptParts: string[] = [];

    const questionsList = (session.spoergsmaal as Array<{ id: string; text: string }>) || [];

    questionsList.forEach((q) => {
      const ans = answers[q.id];
      if (ans && ans.text) {
        transcriptParts.push(`Spørgsmål: ${q.text}\nSvar: ${ans.text}`);
        if (ans.text.length > 35) {
          quotes.push(ans.text);
        }
      }
    });

    if (finalComment) {
      transcriptParts.push(`Afsluttende bemærkning: ${finalComment}`);
    }

    const fullTranscript = transcriptParts.join("\n\n");
    const summary = `Interview med ${session.kildeNavn || "Kilde"}. ${Object.keys(answers).length} spørgsmål besvaret.`;

    await db.interviewSession.update({
      where: { token },
      data: {
        status: "GENNEMFOERT",
        svar: answers,
        citater: quotes,
        transskription: fullTranscript,
        aiOpsummering: summary,
      },
    });

    revalidatePath(`/interview/${token}`);
    revalidatePath("/redaktion/indbakke");
    revalidatePath("/redaktion/interview");

    return { success: true };
  } catch (error) {
    console.error("Fejl ved gennemførelse af interview:", error);
    return { success: false, error: "Der opstod en fejl under interviewet." };
  }
}

export async function createPublicInterview(formData: {
  kildeNavn: string;
  kildeKontakt: string;
  kildeRolle?: string;
  emne: string;
  tema?: string;
}) {
  try {
    const site = await getCurrentSite();

    const questions = [
      { id: "int-1", text: `Fortæl os om dit engagement i ${formData.emne} — hvad er din rolle, og hvorfor brænder du for det?` },
      { id: "int-2", text: `Hvilke konkrete udfordringer eller sejre oplever du i lokalområdet lige nu?` },
      { id: "int-3", text: `Hvad håber du, der sker på dette område over de næste 12 måneder i ${site.kommune}?` },
      { id: "int-4", text: `Hvis du skulle give et godt råd til borgerne eller lokalpolitikerne, hvad ville det så være?` },
    ];

    const interview = await db.interviewSession.create({
      data: {
        titel: `Interview: ${formData.kildeNavn} om ${formData.emne}`,
        emne: formData.emne,
        formaal: formData.tema || "Lokalt kildeinterview",
        kildeNavn: formData.kildeNavn,
        kildeKontakt: formData.kildeKontakt,
        kildeRolle: formData.kildeRolle || null,
        status: "OPRETTET",
        spoergsmaal: questions,
        svar: {},
        instansId: site.id,
      },
    });

    revalidatePath("/redaktion/indbakke");
    revalidatePath("/redaktion/interview");

    return { success: true, token: interview.token };
  } catch (error) {
    console.error("Fejl ved oprettelse af interview:", error);
    return { success: false, error: "Kunne ikke oprette interviewet." };
  }
}
