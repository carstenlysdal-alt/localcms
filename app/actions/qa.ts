"use server";

import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { revalidatePath } from "next/cache";

export async function submitQaAnswers(
  token: string,
  answers: Record<string, { choice?: string; text: string }>
) {
  try {
    const qa = await db.sourceQA.findUnique({
      where: { token },
    });

    if (!qa) {
      return { success: false, error: "Q&A-sessionen blev ikke fundet." };
    }

    // Ekstrahér citater fra svarene
    const quotes: string[] = [];
    Object.values(answers).forEach((ans) => {
      if (ans.text && ans.text.trim().length > 25) {
        quotes.push(ans.text.trim());
      }
    });

    const summary = `Besvaret af kilde (${qa.kildeNavn || "Anonym"}). ${Object.keys(answers).length} spørgsmål besvaret.`;

    await db.sourceQA.update({
      where: { token },
      data: {
        status: "BESVARET",
        svar: answers,
        citater: quotes,
        aiOpsummering: summary,
      },
    });

    revalidatePath(`/qa/${token}`);
    revalidatePath("/redaktion/indbakke");
    revalidatePath("/redaktion/qa");

    return { success: true };
  } catch (error) {
    console.error("Fejl ved indsendelse af Q&A-svar:", error);
    return { success: false, error: "Der opstod en fejl. Prøv igen." };
  }
}

export async function createPublicQaInquiry(formData: {
  kildeNavn: string;
  kildeKontakt: string;
  kildeRolle?: string;
  emne: string;
  baggrund?: string;
  udtalelse?: string;
}) {
  try {
    const site = await getCurrentSite();

    const questions = [
      { id: "q-1", text: "Hvad er den vigtigste pointe i dit budskab?", type: "text" },
      { id: "q-2", text: "Hvilken betydning har dette for borgerne i lokalområdet?", type: "text" },
      { id: "q-3", text: "Er der konkrete fakta, tal eller tidsfrister, vi bør kende?", type: "text" },
    ];

    const answers: Record<string, { text: string }> = {};
    if (formData.udtalelse) {
      answers["q-1"] = { text: formData.udtalelse };
    }

    const qa = await db.sourceQA.create({
      data: {
        titel: formData.emne,
        emne: formData.emne,
        baggrund: formData.baggrund || null,
        kildeNavn: formData.kildeNavn,
        kildeKontakt: formData.kildeKontakt,
        kildeRolle: formData.kildeRolle || null,
        status: formData.udtalelse ? "BESVARET" : "AFVENTER_SVAR",
        spoergsmaal: questions,
        svar: answers,
        instansId: site.id,
      },
    });

    revalidatePath("/redaktion/indbakke");
    revalidatePath("/redaktion/qa");

    return { success: true, token: qa.token };
  } catch (error) {
    console.error("Fejl ved oprettelse af kildeforespørgsel:", error);
    return { success: false, error: "Kunne ikke oprette henvendelsen." };
  }
}

export async function createJournalistQa(data: {
  titel: string;
  emne: string;
  baggrund?: string;
  deadline?: string;
  kildeNavn: string;
  kildeKontakt: string;
  kildeRolle?: string;
  spoergsmaal: string[];
}) {
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    if (!session?.user) return { success: false, error: "Ikke autoriseret." };

    const questions = data.spoergsmaal
      .filter((q) => q.trim().length > 0)
      .map((text, idx) => ({ id: `q-${idx + 1}`, text, type: "text" }));

    const qa = await db.sourceQA.create({
      data: {
        titel: data.titel,
        emne: data.emne,
        baggrund: data.baggrund || null,
        deadline: data.deadline ? new Date(data.deadline) : null,
        kildeNavn: data.kildeNavn,
        kildeKontakt: data.kildeKontakt,
        kildeRolle: data.kildeRolle || null,
        status: "AFVENTER_SVAR",
        spoergsmaal: questions.length > 0 ? questions : [{ id: "q-1", text: "Hvad er din kommentar til sagen?", type: "text" }],
        svar: {},
        instansId: session.user.instansId,
      },
    });

    revalidatePath("/redaktion/qa");
    revalidatePath("/redaktion/indbakke");

    return { success: true, token: qa.token };
  } catch (error) {
    console.error("Fejl ved oprettelse af journalist-Q&A:", error);
    return { success: false, error: "Der opstod en fejl." };
  }
}

