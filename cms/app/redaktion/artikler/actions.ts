"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFreshSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, canEditArticle, PERMISSIONS } from "@/lib/permissions";
import { purgeInstance } from "@/lib/cache/purge";
import { persistArticleSave, prepareArticleSave } from "@/lib/article-save";
import { articleInputFromFormData, baseVersionFromFormData } from "@/lib/article-form-input";
import { computeSeoScore } from "@/lib/editor/seo-score";
import { blocksPlainText, countWords } from "@/lib/blocks/text";
import { parseBlocks } from "@/lib/blocks/schema";

export type ArticleFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
  /** Ikke-blokerende advarsler (fx ufuldstændig metadata ved publicering). */
  warnings?: string[];
  /** Ny version (ms) efter vellykket gem — klientens næste autosave bruger den som baseVersion. */
  version?: number;
  /** Sat når en konflikt blev opdaget (artiklen er ændret et andet sted). */
  conflict?: boolean;
  articleId?: string;
  slug?: string;
};

export async function saveArticle(articleId: string | null, _: ArticleFormState, formData: FormData): Promise<ArticleFormState> {
  const session = await getFreshSession();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) return { error: "Du har ikke adgang til at gemme artikler." };

  const parsed = articleInputFromFormData(formData);
  if (!parsed.ok) return { error: parsed.error };
  const targetStatus = formData.get("targetStatus");
  const prepared = await prepareArticleSave(session.user, articleId, parsed.input, {
    mode: "full",
    targetStatus: typeof targetStatus === "string" ? targetStatus : null,
    baseVersion: baseVersionFromFormData(formData),
  });
  if (!prepared.ok) return { error: prepared.error, fieldErrors: prepared.fieldErrors, conflict: prepared.conflict };

  const saved = await persistArticleSave(prepared);
  if (!saved.ok) return { error: saved.error };
  const article = saved.article;
  if (saved.created) redirect(`/redaktion/artikler/${article.id}?created=1`);

  // Metadata-tjek er en ADVARSEL, aldrig en blokering (leverance 3).
  let warnings: string[] | undefined;
  if (prepared.nextStatus === "Publiceret" && prepared.current?.status !== "Publiceret") {
    const [tagCount, geoCount, cover] = await Promise.all([
      Promise.resolve(parsed.input.tagIds.length),
      Promise.resolve(parsed.input.geoTagIds.length),
      parsed.input.coverMediaId ? db.media.findFirst({ where: { id: parsed.input.coverMediaId, instansId: session.user.instansId }, select: { altTekst: true } }) : Promise.resolve(null),
    ]);
    let wordCount = 0;
    try { wordCount = countWords(blocksPlainText(parseBlocks(parsed.input.blocks))); } catch { /* ugyldige blokke fanges allerede */ }
    const score = computeSeoScore({
      titel: parsed.input.titel, seoTitel: parsed.input.seoTitel, manchet: parsed.input.manchet, seoBeskrivelse: parsed.input.seoBeskrivelse,
      slug: article.slug, kategoriId: parsed.input.kategoriId, forfatterId: parsed.input.forfatterId, cover, tagCount, geoCount, wordCount,
      meta: prepared.meta ?? undefined, shareImageAvailable: Boolean(cover),
    });
    if (!score.complete) warnings = score.warnings;
  }
  return {
    success: prepared.nextStatus === "Publiceret" ? "Artiklen er publiceret." : "Ændringerne er gemt.",
    version: article.opdateretTid.getTime(),
    articleId: article.id,
    slug: article.slug,
    ...(warnings ? { warnings } : {}),
  };
}

export async function toggleArticleFlag(articleId: string, flag: "pinned" | "breaking") {
  const session = await getFreshSession();
  if (!session?.user || !can(session.user, PERMISSIONS.FRONTPAGE_EDIT)) throw new Error("Ingen adgang til forsidestyring.");
  if (flag !== "pinned" && flag !== "breaking") throw new Error("Ukendt markering.");
  const article = await db.article.findFirst({ where: { id: articleId, instansId: session.user.instansId }, select: { pinned: true, breaking: true } });
  if (!article) throw new Error("Artiklen findes ikke.");
  await db.article.update({ where: { id: articleId }, data: { [flag]: !article[flag] } });
  revalidatePath("/redaktion/artikler");
  revalidatePath("/");
  void purgeInstance(session.user.instansId);
}

export type CorrectionActionState = {
  error?: string;
  success?: string;
};

export async function addArticleCorrection(
  articleId: string,
  _prevState: CorrectionActionState,
  formData: FormData
): Promise<CorrectionActionState> {
  const session = await getFreshSession();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) {
    return { error: "Du har ikke adgang til at tilføje rettelser." };
  }

  const article = await db.article.findFirst({
    where: { id: articleId, instansId: session.user.instansId },
    include: { kategori: true },
  });

  if (!article) {
    return { error: "Artiklen findes ikke." };
  }

  if (!canEditArticle(session.user, article) && !can(session.user, PERMISSIONS.ARTICLE_EDIT_ALL)) {
    return { error: "Du har ikke rettigheder til at redigere denne artikel." };
  }

  const rawTekst = formData.get("tekst");
  if (typeof rawTekst !== "string" || rawTekst.trim().length < 5) {
    return { error: "Angiv en fyldestgørende rettelsestekst (mindst 5 tegn)." };
  }

  // Rettelsens dato er ALTID tidspunktet for oprettelsen (T5 P2-5): en rettelse kan ikke bagdateres, og
  // oprettelsen registreres med brugerens id. Et evt. "dato"-felt i formularen ignoreres.
  try {
    await db.correction.create({
      data: {
        articleId,
        instansId: session.user.instansId,
        tekst: rawTekst.trim(),
        dato: new Date(),
        oprettetAf: session.user.id,
      },
    });

    revalidatePath(`/redaktion/artikler/${articleId}`);
    revalidatePath("/om-mediet/rettelser");
    if (article.kategori) {
      revalidatePath(`/${article.kategori.slug}/${article.slug}`);
    }

    return { success: "Rettelsen er tilføjet og fremgår nu i artiklen samt i rettelsesloggen." };
  } catch (err) {
    console.error("[rettelser] kunne ikke oprette rettelse:", err);
    return { error: "Kunne ikke tilføje rettelsen." };
  }
}

/**
 * Fjerner en rettelse fra den offentlige log. Rettelser slettes ALDRIG fysisk (Pressenævnet-relevant spor): de markeres
 * som fjernet med tidspunkt og bruger. Kræver redaktørrettighed (publicering eller redigering af alle artikler) —
 * en forfatter kan tilføje rettelser, men ikke fjerne dem.
 */
export async function deleteArticleCorrection(
  correctionId: string,
  articleId: string
): Promise<CorrectionActionState> {
  const session = await getFreshSession();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE) || !(can(session.user, PERMISSIONS.ARTICLE_PUBLISH) || can(session.user, PERMISSIONS.ARTICLE_EDIT_ALL))) {
    return { error: "Kun en redaktør med publicerings- eller redigeringsret kan fjerne en rettelse." };
  }

  const correction = await db.correction.findFirst({
    where: { id: correctionId, instansId: session.user.instansId, fjernetTid: null },
    include: { article: { include: { kategori: true } } },
  });

  if (!correction) {
    return { error: "Rettelsen findes ikke." };
  }

  try {
    await db.correction.update({
      where: { id: correction.id },
      data: { fjernetTid: new Date(), fjernetAf: session.user.id },
    });

    revalidatePath(`/redaktion/artikler/${articleId}`);
    revalidatePath("/om-mediet/rettelser");
    if (correction.article?.kategori) {
      revalidatePath(`/${correction.article.kategori.slug}/${correction.article.slug}`);
    }

    return { success: "Rettelsen er fjernet fra den offentlige log (registreret med bruger og tidspunkt)." };
  } catch (err) {
    console.error("[rettelser] kunne ikke fjerne rettelse:", err);
    return { error: "Kunne ikke fjerne rettelsen." };
  }
}
