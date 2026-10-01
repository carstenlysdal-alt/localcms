"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentSite } from "@/lib/site";
import { guardPublicAction } from "@/lib/ratelimit/guard";
import { cleanText } from "@/lib/validation/text";
import { generateToken, looksLikeToken } from "@/lib/validation/tokens";
import { firstIssue, interviewAnswersInput, longText, publicInterviewInput } from "@/lib/validation/public";
import { isAnswered } from "@/lib/validation/status";

export async function submitInterviewAnswers(
  token: string,
  answers: Record<string, { text: string; audioUrl?: string }>,
  finalComment?: string
) {
  try {
    const guard = await guardPublicAction({ action: "interview-answers", limit: 15, windowMs: 10 * 60_000 });
    if (!guard.ok) return { success: false, error: guard.error };

    if (!looksLikeToken(token)) return { success: false, error: "Interviewet blev ikke fundet." };
    const parsed = interviewAnswersInput.safeParse(answers);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error, "Kontrollér dine svar.") };
    const comment = finalComment ? longText(4000).safeParse(finalComment) : null;
    if (comment && !comment.success) return { success: false, error: firstIssue(comment.error) };

    const session = await db.interviewSession.findUnique({ where: { token } });
    if (!session) return { success: false, error: "Interviewet blev ikke fundet." };
    if (isAnswered("interview", session.status)) return { success: false, error: "Dette interview er allerede gennemført." };

    const quotes: string[] = [];
    const transcriptParts: string[] = [];
    const questionsList = (session.spoergsmaal as Array<{ id: string; text: string }>) || [];
    const clean: Record<string, { text: string; audioUrl?: string }> = {};

    questionsList.forEach((q) => {
      const ans = parsed.data[q.id];
      if (ans && ans.text) {
        clean[q.id] = { text: ans.text, ...(ans.audioUrl ? { audioUrl: ans.audioUrl } : {}) };
        transcriptParts.push(`Spørgsmål: ${q.text}\nSvar: ${ans.text}`);
        if (ans.text.length > 35) quotes.push(ans.text);
      }
    });
    if (Object.keys(clean).length === 0) return { success: false, error: "Ingen gyldige svar modtaget." };

    if (comment?.success && comment.data) transcriptParts.push(`Afsluttende bemærkning: ${comment.data}`);

    const fullTranscript = transcriptParts.join("\n\n");
    const summary = `Interview med ${cleanText(session.kildeNavn || "Kilde", 120)}. ${Object.keys(clean).length} spørgsmål besvaret.`;

    await db.interviewSession.update({
      where: { token },
      data: { status: "Besvaret", svar: clean, citater: quotes, transskription: fullTranscript, aiOpsummering: summary },
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
  /** Honeypot — skal være tomt. */
  website?: string;
}) {
  try {
    const guard = await guardPublicAction({ action: "interview-create", limit: 5, windowMs: 30 * 60_000, honeypot: formData?.website, captcha: formData });
    if (!guard.ok) return { success: false, error: guard.error };

    const parsed = publicInterviewInput.safeParse(formData);
    if (!parsed.success) return { success: false, error: firstIssue(parsed.error) };
    const input = parsed.data;

    const site = await getCurrentSite();

    const questions = [
      { id: "int-1", text: `Fortæl os om dit engagement i ${input.emne} — hvad er din rolle, og hvorfor brænder du for det?` },
      { id: "int-2", text: `Hvilke konkrete udfordringer eller sejre oplever du i lokalområdet lige nu?` },
      { id: "int-3", text: `Hvad håber du, der sker på dette område over de næste 12 måneder i ${site.kommune}?` },
      { id: "int-4", text: `Hvis du skulle give et godt råd til borgerne eller lokalpolitikerne, hvad ville det så være?` },
    ];

    const interview = await db.interviewSession.create({
      data: {
        token: generateToken(),
        titel: `Interview: ${input.kildeNavn} om ${input.emne}`.slice(0, 300),
        emne: input.emne,
        formaal: input.tema || "Lokalt kildeinterview",
        kildeNavn: input.kildeNavn,
        kildeKontakt: input.kildeKontakt,
        kildeRolle: input.kildeRolle || null,
        status: "Oprettet", // kanonisk (tidligere "OPRETTET")
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
