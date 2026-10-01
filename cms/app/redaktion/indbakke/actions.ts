"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base || "indsendt-forslag";
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: "Ny" | "Behandles" | "Afvist",
  noter?: string
) {
  const session = await auth();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) {
    return { success: false, error: "Du har ikke rettigheder til at opdatere indsendelser." };
  }

  const sub = await db.submission.findFirst({
    where: { id: submissionId, instansId: session.user.instansId },
  });

  if (!sub) {
    return { success: false, error: "Indsendelsen blev ikke fundet." };
  }

  await db.submission.update({
    where: { id: submissionId },
    data: {
      status,
      ...(typeof noter === "string" ? { noter } : {}),
    },
  });

  revalidatePath("/redaktion/indbakke");
  return { success: true };
}

export async function convertSubmissionToArticle(submissionId: string) {
  const session = await auth();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) {
    return { success: false, error: "Du har ikke rettigheder til at oprette artikler." };
  }

  const sub = await db.submission.findFirst({
    where: { id: submissionId, instansId: session.user.instansId },
    include: { omraade: true },
  });

  if (!sub) {
    return { success: false, error: "Indsendelsen blev ikke fundet." };
  }

  if (sub.status === "ArtikelOprettet" && sub.articleId) {
    return {
      success: true,
      articleId: sub.articleId,
      message: "Der er allerede oprettet en artikel for denne indsendelse.",
    };
  }

  // Find en passende standardkategori (f.eks. Debat, Foreningsliv eller første kategori på instansen)
  let defaultCategory = await db.category.findFirst({
    where: {
      instansId: session.user.instansId,
      slug: { in: ["debat", "foreningsliv", "kultur", "nyheder"] },
    },
  });

  if (!defaultCategory) {
    defaultCategory = await db.category.findFirst({
      where: { instansId: session.user.instansId },
    });
  }

  // Generer unik slug
  const baseSlug = slugify(sub.emne);
  let slug = baseSlug;
  let counter = 1;
  while (await db.article.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  // Opret struktureret blok
  const blocks = [
    {
      id: `p-${Date.now()}`,
      type: "paragraph",
      data: {
        text: sub.tekst,
      },
    },
  ];

  // Manchet
  const manchet =
    sub.tekst.length > 170
      ? `${sub.tekst.slice(0, 167).trim()}...`
      : sub.tekst;

  // Opret ny artikel med indholdstype "Brugerindsendt"
  const newArticle = await db.article.create({
    data: {
      titel: sub.emne,
      manchet,
      slug,
      blocks,
      status: "Idé",
      indholdstype: "Brugerindsendt",
      aiBrug: [],
      marking: {
        afsender: sub.navn,
        oprindeligKontakt: sub.kontakt,
        rettighederBekræftet: sub.rettighederAccepteret,
        samtykkeGivet: sub.samtykkeAccepteret,
      },
      kategoriId: defaultCategory?.id || null,
      forfatterId: session.user.authorId || null,
      instansId: session.user.instansId,
      geoTags: sub.omraadeId ? { connect: [{ id: sub.omraadeId }] } : undefined,
    },
  });

  // Opdater indsendelse
  await db.submission.update({
    where: { id: submissionId },
    data: {
      status: "ArtikelOprettet",
      articleId: newArticle.id,
    },
  });

  revalidatePath("/redaktion/indbakke");
  revalidatePath("/redaktion/artikler");

  return {
    success: true,
    articleId: newArticle.id,
    message: "Artiklen er oprettet som udkast under 'Brugerindsendt'.",
  };
}

export async function deleteSubmission(submissionId: string) {
  const session = await auth();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) {
    return { success: false, error: "Du har ikke rettigheder til at slette indsendelser." };
  }

  await db.submission.deleteMany({
    where: { id: submissionId, instansId: session.user.instansId },
  });

  revalidatePath("/redaktion/indbakke");
  return { success: true };
}

export async function convertQaToArticle(qaId: string) {
  const session = await auth();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) {
    return { success: false, error: "Du har ikke rettigheder til at oprette artikler." };
  }

  const qa = await db.sourceQA.findFirst({
    where: { id: qaId, instansId: session.user.instansId },
  });

  if (!qa) {
    return { success: false, error: "Q&A-sessionen blev ikke fundet." };
  }

  if (qa.status === "ArtikelOprettet" && qa.articleId) {
    return { success: true, articleId: qa.articleId, message: "Artikel er allerede oprettet." };
  }

  const defaultCategory = await db.category.findFirst({
    where: { instansId: session.user.instansId },
  });

  const baseSlug = slugify(`qa-${qa.kildeNavn || "kilde"}-${qa.titel}`);
  let slug = baseSlug;
  let counter = 1;
  while (await db.article.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const answersObj = (qa.svar as Record<string, { text?: string }>) || {};
  const questionsList = (qa.spoergsmaal as Array<{ id: string; text: string }>) || [];

  const blocks: Array<Record<string, unknown>> = [
    {
      id: `intro-${Date.now()}`,
      type: "paragraph",
      data: {
        text: qa.baggrund || `Q&A med ${qa.kildeNavn || "kilde"} (${qa.kildeRolle || "kilde"}) om ${qa.emne}.`,
      },
    },
  ];

  questionsList.forEach((q, idx) => {
    const ans = answersObj[q.id]?.text || "Ingen udtalelse.";
    blocks.push({
      id: `h-${Date.now()}-${idx}`,
      type: "heading",
      data: { level: 3, text: q.text },
    });
    blocks.push({
      id: `p-${Date.now()}-${idx}`,
      type: "paragraph",
      data: { text: ans },
    });
  });

  const manchet = qa.aiOpsummering || `${qa.kildeNavn || "Kilde"} svarer på redaktionens spørgsmål vedrørende ${qa.emne}.`;

  const newArticle = await db.article.create({
    data: {
      titel: `Q&A: ${qa.titel}`,
      manchet,
      slug,
      blocks: blocks as unknown as Prisma.InputJsonValue,
      status: "Idé",
      indholdstype: "Uafhængig",
      aiBrug: ["Assisteret indsamling via Kilde-Q&A"],
      marking: {
        kilde: qa.kildeNavn,
        kildeRolle: qa.kildeRolle,
        kildeKontakt: qa.kildeKontakt,
        type: "Kilde-Q&A",
      },
      kategoriId: defaultCategory?.id || null,
      forfatterId: session.user.authorId || null,
      instansId: session.user.instansId,
    },
  });

  await db.sourceQA.update({
    where: { id: qaId },
    data: {
      status: "ArtikelOprettet",
      articleId: newArticle.id,
    },
  });

  revalidatePath("/redaktion/indbakke");
  revalidatePath("/redaktion/qa");
  revalidatePath("/redaktion/artikler");

  return { success: true, articleId: newArticle.id, message: "Artikelkladde oprettet fra Kilde-Q&A." };
}

export async function convertInterviewToArticle(interviewId: string) {
  const session = await auth();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) {
    return { success: false, error: "Du har ikke rettigheder til at oprette artikler." };
  }

  const interview = await db.interviewSession.findFirst({
    where: { id: interviewId, instansId: session.user.instansId },
  });

  if (!interview) {
    return { success: false, error: "Interviewet blev ikke fundet." };
  }

  if (interview.status === "ArtikelOprettet" && interview.articleId) {
    return { success: true, articleId: interview.articleId, message: "Artikel er allerede oprettet." };
  }

  const defaultCategory = await db.category.findFirst({
    where: { instansId: session.user.instansId },
  });

  const baseSlug = slugify(`interview-${interview.kildeNavn || "kilde"}-${interview.titel}`);
  let slug = baseSlug;
  let counter = 1;
  while (await db.article.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const answersObj = (interview.svar as Record<string, { text?: string }>) || {};
  const questionsList = (interview.spoergsmaal as Array<{ id: string; text: string }>) || [];

  const blocks: Array<Record<string, unknown>> = [
    {
      id: `p-intro-${Date.now()}`,
      type: "paragraph",
      data: {
        text: `I et interview med redaktionen sætter ${interview.kildeNavn || "kilden"} (${interview.kildeRolle || "lokal stemme"}) ord på ${interview.emne}.`,
      },
    },
  ];

  questionsList.forEach((q, idx) => {
    const ans = answersObj[q.id]?.text;
    if (ans) {
      blocks.push({
        id: `q-${Date.now()}-${idx}`,
        type: "heading",
        data: { level: 3, text: q.text },
      });
      blocks.push({
        id: `a-${Date.now()}-${idx}`,
        type: "paragraph",
        data: { text: ans },
      });
    }
  });

  const manchet = interview.aiOpsummering || `Interview med ${interview.kildeNavn || "kilde"} om ${interview.emne}.`;

  const newArticle = await db.article.create({
    data: {
      titel: interview.titel.startsWith("Interview:") ? interview.titel : `Interview: ${interview.titel}`,
      manchet,
      slug,
      blocks: blocks as unknown as Prisma.InputJsonValue,
      status: "Idé",
      indholdstype: "Uafhængig",
      aiBrug: ["AI-guidet interviewtransskription"],
      marking: {
        kilde: interview.kildeNavn,
        kildeRolle: interview.kildeRolle,
        interviewer: interview.journalistNavn || session.user.name,
        type: "AI-Kildeinterview",
      },
      kategoriId: defaultCategory?.id || null,
      forfatterId: session.user.authorId || null,
      instansId: session.user.instansId,
    },
  });

  await db.interviewSession.update({
    where: { id: interviewId },
    data: {
      status: "ArtikelOprettet",
      articleId: newArticle.id,
    },
  });

  revalidatePath("/redaktion/indbakke");
  revalidatePath("/redaktion/interview");
  revalidatePath("/redaktion/artikler");

  return { success: true, articleId: newArticle.id, message: "Artikelkladde oprettet fra AI Interview." };
}

export async function convertSponsorBriefToArticle(briefId: string) {
  const session = await auth();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) {
    return { success: false, error: "Du har ikke rettigheder til at oprette artikler." };
  }

  const brief = await db.sponsorBrief.findFirst({
    where: { id: briefId, instansId: session.user.instansId },
  });

  if (!brief) {
    return { success: false, error: "Sponsor-briefet blev ikke fundet." };
  }

  if (brief.status === "ArtikelOprettet" && brief.articleId) {
    return { success: true, articleId: brief.articleId, message: "Artikel er allerede oprettet." };
  }

  // Find Erhverv eller standardkategori
  let category = await db.category.findFirst({
    where: {
      instansId: session.user.instansId,
      slug: { in: ["erhverv", "nyheder", "kultur"] },
    },
  });
  if (!category) {
    category = await db.category.findFirst({ where: { instansId: session.user.instansId } });
  }

  const baseSlug = slugify(`partner-${brief.partnerNavn}`);
  let slug = baseSlug;
  let counter = 1;
  while (await db.article.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const briefData = (brief.briefData as Record<string, string>) || {};

  const blocks: Array<Record<string, unknown>> = [
    {
      id: `p-disc-${Date.now()}`,
      type: "paragraph",
      data: {
        text: `◆ FINANSIERET AF ${brief.partnerNavn.toUpperCase()} — Denne artikel er udarbejdet i samarbejde med vores lokale partner.`,
      },
    },
    {
      id: `p-budskab-${Date.now()}`,
      type: "paragraph",
      data: {
        text: briefData.budskab || briefData.formaal || `Mød ${brief.partnerNavn}.`,
      },
    },
  ];

  if (briefData.fakta) {
    blocks.push({
      id: `h-fakta-${Date.now()}`,
      type: "heading",
      data: { level: 3, text: "Fakta & Baggrund" },
    });
    blocks.push({
      id: `p-fakta-${Date.now()}`,
      type: "paragraph",
      data: { text: briefData.fakta },
    });
  }

  const newArticle = await db.article.create({
    data: {
      titel: `${brief.partnerNavn}: ${briefData.budskab ? briefData.budskab.slice(0, 50) : "Lokalt partnerskab"}`,
      manchet: briefData.formaal || `Partnerartikel bragt i samarbejde med ${brief.partnerNavn}.`,
      slug,
      blocks: blocks as unknown as Prisma.InputJsonValue,
      status: "Idé",
      indholdstype: "Partner",
      aiBrug: [],
      marking: {
        sponsor: brief.partnerNavn,
        sponsorKontakt: brief.kontaktEmail,
        sponsorPakke: brief.pakkeNavn,
        deklaration: `Finansieret af ${brief.partnerNavn}`,
        afmærkningKrav: "◆ FINANSIERET AF",
      },
      kategoriId: category?.id || null,
      forfatterId: session.user.authorId || null,
      instansId: session.user.instansId,
    },
  });

  await db.sponsorBrief.update({
    where: { id: briefId },
    data: {
      status: "ArtikelOprettet",
      articleId: newArticle.id,
    },
  });

  revalidatePath("/redaktion/indbakke");
  revalidatePath("/redaktion/sponsor");
  revalidatePath("/redaktion/artikler");

  return { success: true, articleId: newArticle.id, message: "Partner-artikel oprettet som udkast." };
}

export async function convertMeddelerSagToArticle(sagId: string) {
  const session = await auth();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) {
    return { success: false, error: "Du har ikke rettigheder til at oprette artikler." };
  }

  const sag = await db.meddelerSag.findFirst({
    where: { id: sagId, instansId: session.user.instansId },
    include: { meddeler: true },
  });

  if (!sag) {
    return { success: false, error: "Meddeler-sagen blev ikke fundet." };
  }

  if (sag.status === "ArtikelOprettet" && sag.articleId) {
    return { success: true, articleId: sag.articleId, message: "Artikel er allerede oprettet." };
  }

  // Find passende kategori baseret på sag.kategori (f.eks. sport, kultur)
  let category = await db.category.findFirst({
    where: {
      instansId: session.user.instansId,
      slug: sag.kategori ? sag.kategori.toLowerCase() : "nyheder",
    },
  });
  if (!category) {
    category = await db.category.findFirst({ where: { instansId: session.user.instansId } });
  }

  const baseSlug = slugify(`meddeler-${sag.titel}`);
  let slug = baseSlug;
  let counter = 1;
  while (await db.article.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter++}`;
  }

  const blocks: Array<Record<string, unknown>> = [
    {
      id: `p-meddeler-${Date.now()}`,
      type: "paragraph",
      data: {
        text: sag.tekst,
      },
    },
  ];

  const manchet = sag.tekst.length > 170 ? `${sag.tekst.slice(0, 167).trim()}...` : sag.tekst;

  const newArticle = await db.article.create({
    data: {
      titel: sag.titel,
      manchet,
      slug,
      blocks: blocks as unknown as Prisma.InputJsonValue,
      status: "Idé",
      indholdstype: "AI-assisteret",
      aiBrug: ["AI-struktureret meddelerrapport"],
      marking: {
        afsender: sag.meddeler?.navn || "Lokal meddeler",
        organisation: sag.meddeler?.organisation || null,
        kategori: sag.kategori,
        type: "Meddeler-rapport",
      },
      kategoriId: category?.id || null,
      forfatterId: session.user.authorId || null,
      instansId: session.user.instansId,
    },
  });

  await db.meddelerSag.update({
    where: { id: sagId },
    data: {
      status: "ArtikelOprettet",
      articleId: newArticle.id,
    },
  });

  revalidatePath("/redaktion/indbakke");
  revalidatePath("/redaktion/meddeler");
  revalidatePath("/redaktion/artikler");

  return { success: true, articleId: newArticle.id, message: "Artikel oprettet fra meddeler-rapport." };
}

