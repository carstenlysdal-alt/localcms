"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAuthorizedUser } from "@/lib/auth";
import { getCurrentSite } from "@/lib/site";
import { PERMISSIONS } from "@/lib/permissions";
import { guardPublicAction } from "@/lib/ratelimit/guard";
import { cleanText } from "@/lib/validation/text";
import { generateToken, looksLikeToken } from "@/lib/validation/tokens";
import { firstIssue, journalistQaInput, publicQaInquiryInput, qaAnswersInput } from "@/lib/validation/public";
import { isAnswered } from "@/lib/validation/status";

export async function submitQaAnswers(
  token: string,
  answers: Record<string, { choice?: string; text: string }>
) {
  try {
    const guard = await guardPublicAction({ action: "qa-answers", limit: 15, windowMs: 10 * 60_000 });
    if (!guard.ok) return { success: false, error: guard.error };

    if (!looksLikeToken(token)) return { success: false, error: "Q&A-sessionen blev ikke fundet." };
    const parsed = qaAnswersInput.safeParse(answers);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error, "Kontrollér dine svar.") };

    const qa = await db.sourceQA.findUnique({ where: { token } });
    if (!qa) return { success: false, error: "Q&A-sessionen blev ikke fundet." };
    if (isAnswered("qa", qa.status)) return { success: false, error: "Denne Q&A er allerede besvaret." };

    // Kun svar på kendte spørgsmål gemmes.
    const known = new Set(((qa.spoergsmaal as Array<{ id: string }>) || []).map((q) => q.id));
    const clean: Record<string, { choice?: string; text: string }> = {};
    for (const [id, ans] of Object.entries(parsed.data)) {
      if (known.size > 0 && !known.has(id)) continue;
      clean[id] = { ...(ans.choice ? { choice: ans.choice } : {}), text: ans.text };
    }
    if (Object.keys(clean).length === 0) return { success: false, error: "Ingen gyldige svar modtaget." };

    const quotes = Object.values(clean).map((a) => a.text.trim()).filter((t) => t.length > 25);
    const summary = `Besvaret af kilde (${cleanText(qa.kildeNavn || "Anonym", 120)}). ${Object.keys(clean).length} spørgsmål besvaret.`;

    await db.sourceQA.update({
      where: { token },
      data: { status: "Besvaret", svar: clean, citater: quotes, aiOpsummering: summary },
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
  /** Honeypot — skal være tomt. */
  website?: string;
}) {
  try {
    const guard = await guardPublicAction({ action: "qa-inquiry", limit: 5, windowMs: 30 * 60_000, honeypot: formData?.website });
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = publicQaInquiryInput.safeParse(formData);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const input = parsed.data;

    const site = await getCurrentSite();

    const questions = [
      { id: "q-1", text: "Hvad er den vigtigste pointe i dit budskab?", type: "text" },
      { id: "q-2", text: "Hvilken betydning har dette for borgerne i lokalområdet?", type: "text" },
      { id: "q-3", text: "Er der konkrete fakta, tal eller tidsfrister, vi bør kende?", type: "text" },
    ];

    const answers: Record<string, { text: string }> = {};
    if (input.udtalelse) answers["q-1"] = { text: input.udtalelse };

    const qa = await db.sourceQA.create({
      data: {
        token: generateToken(),
        titel: input.emne,
        emne: input.emne,
        baggrund: input.baggrund || null,
        kildeNavn: input.kildeNavn,
        kildeKontakt: input.kildeKontakt,
        kildeRolle: input.kildeRolle || null,
        status: input.udtalelse ? "Besvaret" : "Sendt",
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
    const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_CREATE);
    if (!user) return { success: false, error: "Ikke autoriseret." };

    const parsed = journalistQaInput.safeParse(data);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const input = parsed.data;

    const questions = input.spoergsmaal.map((text, idx) => ({ id: `q-${idx + 1}`, text, type: "text" }));

    const qa = await db.sourceQA.create({
      data: {
        token: generateToken(),
        titel: input.titel,
        emne: input.emne,
        baggrund: input.baggrund || null,
        deadline: input.deadline ? new Date(input.deadline) : null,
        kildeNavn: input.kildeNavn,
        kildeKontakt: input.kildeKontakt,
        kildeRolle: input.kildeRolle || null,
        status: "Sendt",
        spoergsmaal: questions.length > 0 ? questions : [{ id: "q-1", text: "Hvad er din kommentar til sagen?", type: "text" }],
        svar: {},
        instansId: user.instansId,
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
