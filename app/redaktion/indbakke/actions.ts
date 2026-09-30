"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

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
