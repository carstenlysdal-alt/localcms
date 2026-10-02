"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getFreshSession } from "@/lib/auth";
import { blocksSchema } from "@/lib/blocks/schema";
import { db } from "@/lib/db";
import { loadCategoryTree } from "@/lib/category-tree";
import { AI_TEXT_GENERATING_USES, AI_USE_NONE, assertPublishableMarking, CONTENT_TYPES, isAiRestrictedCategoryTree, normalizeAiUse } from "@/lib/marking";
import { can, canEditArticle, PERMISSIONS } from "@/lib/permissions";
import { canTransition, isArticleStatus } from "@/lib/workflow";
import { honorAmountForAssignment } from "@/lib/assignments";
import { purgeInstance } from "@/lib/cache/purge";

export type ArticleFormState = { error?: string; success?: string; fieldErrors?: Record<string, string[]> };

const articleSchema = z.object({
  titel: z.string().trim().min(3, "Titlen skal være mindst 3 tegn."),
  manchet: z.string().trim().optional(),
  slug: z.string().trim().min(3).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Brug små bogstaver, tal og bindestreger."),
  indholdstype: z.enum(CONTENT_TYPES),
  kategoriId: z.string().optional(),
  forfatterId: z.string().optional(),
  coverMediaId: z.string().optional(),
  seoTitel: z.string().trim().optional(),
  seoBeskrivelse: z.string().trim().optional(),
  sprog: z.string().trim().min(2),
});

function jsonFromForm(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

export async function saveArticle(articleId: string | null, _: ArticleFormState, formData: FormData): Promise<ArticleFormState> {
  const session = await getFreshSession();
  if (!session?.user || !can(session.user, PERMISSIONS.ARTICLE_CREATE)) return { error: "Du har ikke adgang til at gemme artikler." };

  const values = articleSchema.safeParse(Object.fromEntries(formData));
  if (!values.success) return { fieldErrors: values.error.flatten().fieldErrors, error: "Kontrollér de markerede felter." };
  const blocks = blocksSchema.safeParse(jsonFromForm(formData.get("blocks")));
  if (!blocks.success) return { error: "En eller flere indholdsblokke er ugyldige. Kontrollér især billed-URL og alt-tekst." };

  const current = articleId ? await db.article.findFirst({ where: { id: articleId, instansId: session.user.instansId } }) : null;
  if (articleId && !current) return { error: "Artiklen findes ikke." };
  if (current && !canEditArticle(session.user, current)) return { error: "Du kan kun redigere dine egne artikler." };

  const canControlFrontpage = can(session.user, PERMISSIONS.FRONTPAGE_EDIT);
  const requestedStatus = formData.get("targetStatus");
  let nextStatus = current?.status ?? "Idé";
  if (typeof requestedStatus === "string" && requestedStatus) {
    if (!isArticleStatus(requestedStatus) || !current || !canTransition(current.status, requestedStatus, session.user)) {
      return { error: `Overgangen fra ${current?.status ?? "en ny artikel"} til ${requestedStatus} er ikke tilladt.` };
    }
    nextStatus = requestedStatus;
  }

  // AI-brug: aktivt valg ("Ingen AI brugt" ELLER konkret brug). Uden valg gemmes en tom liste (ikke taget stilling),
  // som ikke kan publiceres — så en artikel uden AI ikke tvinges til en falsk afkrydsning.
  const aiUse = normalizeAiUse(formData.getAll("aiBrug").filter((value): value is string => typeof value === "string"), { requireChoice: nextStatus === "Publiceret" });
  if (!aiUse.ok) return { error: aiUse.error };
  const aiBrug = aiUse.value;
  const currentMarking = current?.marking && typeof current.marking === "object" && !Array.isArray(current.marking) ? (current.marking as Record<string, unknown>) : {};
  let marking: unknown = null;
  if (values.data.indholdstype === "Partner") {
    marking = {
      sponsor: String(formData.get("markingSponsor") ?? ""),
      labelTekst: String(formData.get("markingLabel") ?? ""),
      aftaleId: String(formData.get("markingAftaleId") ?? ""),
    };
  } else if (values.data.indholdstype === "Sponsoreret") {
    marking = {
      sponsor: String(formData.get("markingSponsor") ?? ""),
      labelTekst: String(formData.get("markingLabel") ?? ""),
    };
  } else if (values.data.indholdstype === "Brugerindsendt" || values.data.indholdstype === "PR") {
    marking = {
      afsender: String(formData.get("markingAfsender") ?? ""),
    };
  } else if (values.data.indholdstype === "AI-assisteret") {
    // "Godkendt af" er IKKE fri tekst: ved publicering sættes den til den godkendende (publicerende) bruger, slået op i
    // databasen. Indtil da bevares evt. tidligere værdi; et felt i formularen ignoreres (kan ikke forfalske en godkender).
    const approved = nextStatus === "Publiceret";
    marking = {
      godkendtAf: approved ? session.user.name : typeof currentMarking.godkendtAf === "string" ? currentMarking.godkendtAf : "",
      ...(approved ? { godkendtAfUserId: session.user.id } : typeof currentMarking.godkendtAfUserId === "string" ? { godkendtAfUserId: currentMarking.godkendtAfUserId } : {}),
      kilder: String(formData.get("markingKilder") ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
      ...(currentMarking.maskinleveret === true ? { maskinleveret: true } : {}),
    };
  }

  // Kildeverifikation (T6 nr. 25): kladder fra Q&A/interview/meddeler bærer `uverificeretKilde`. Flaget bevares gennem gem
  // og fjernes kun når redaktøren afkrydser, at kildens identitet er verificeret; publicering kræver at det er fjernet.
  if (typeof currentMarking.uverificeretKilde === "boolean") {
    const verified = formData.get("kildeVerificeret") === "on";
    const carried: Record<string, unknown> = { type: currentMarking.type, uverificeretKilde: !verified };
    marking = marking && typeof marking === "object" ? { ...(marking as Record<string, unknown>), ...carried } : carried;
  }

  if (values.data.indholdstype === "AI-assisteret" && aiBrug.length === 1 && aiBrug[0] === AI_USE_NONE) {
    return { error: "Et AI-assisteret indhold kan ikke registreres med 'Ingen AI brugt'. Vælg den faktiske AI-brug eller skift indholdstype." };
  }

  if (values.data.indholdstype === "AI-assisteret") {
    for (const b of blocks.data) {
      if (b.type === "quote") {
        const qData = b.data as { quote: string; attribution?: string; kildeUrl?: string; dato?: string };
        if (!qData.kildeUrl || !qData.dato) {
          return { error: "Citater i AI-assisterede artikler kræver kilde-URL/reference og dato." };
        }
      }
    }
  }

  if (nextStatus === "Publiceret") {
    if (!can(session.user, PERMISSIONS.ARTICLE_PUBLISH)) return { error: "Kun en redaktør med publiceringsret kan publicere." };
    if (marking && typeof marking === "object" && (marking as { uverificeretKilde?: unknown }).uverificeretKilde === true) {
      return { error: "Kildens identitet er ikke verificeret. Afkryds 'Kildens identitet er verificeret' (i sidebjælken), når redaktionen har kontrolleret kilden." };
    }
    try { assertPublishableMarking(values.data.indholdstype, marking); } catch (error) { return { error: error instanceof Error ? error.message : "Mærkningen er ugyldig." }; }
  }

  const tagIds = formData.getAll("tagIds").filter((v): v is string => typeof v === "string");
  const geoTagIds = formData.getAll("geoTagIds").filter((v): v is string => typeof v === "string");
  const requestedAuthorId = values.data.forfatterId || session.user.authorId;
  const requestedCategoryId = values.data.kategoriId || null;

  // AI-spærring (T5 P2-7): afgøres på kategoriens id og HELE forældrekæden (slug/navn), uafhængigt af indholdstype.
  // Udkast/omskrivning med AI er forbudt i Krimi og retsvæsen/Sundhed, også for "Uafhængig" artikler.
  if (requestedCategoryId) {
    const tree = await loadCategoryTree(session.user.instansId, requestedCategoryId);
    if (tree && isAiRestrictedCategoryTree(tree)) {
      if (values.data.indholdstype === "AI-assisteret") {
        return { error: "Artikler i kategorierne Krimi og retsvæsen samt Sundhed må ikke være AI-assisterede uden journalistisk gennemskrivning." };
      }
      if (aiBrug.some((use) => AI_TEXT_GENERATING_USES.includes(use))) {
        return { error: "AI-brug til udkast eller omskrivning er ikke tilladt i Krimi og retsvæsen samt Sundhed." };
      }
    }
  }

  const requestedCoverMediaId = values.data.coverMediaId || null;
  const [categoryCount, authorCount, coverCount, tagCount, geoTagCount] = await Promise.all([
    requestedCategoryId ? db.category.count({ where: { id: requestedCategoryId, instansId: session.user.instansId } }) : 1,
    requestedAuthorId ? db.author.count({ where: { id: requestedAuthorId, instansId: session.user.instansId } }) : 1,
    requestedCoverMediaId ? db.media.count({ where: { id: requestedCoverMediaId, instansId: session.user.instansId, filtype: "billede" } }) : 1,
    db.tag.count({ where: { id: { in: tagIds }, instansId: session.user.instansId } }),
    db.geoTag.count({ where: { id: { in: geoTagIds }, instansId: session.user.instansId } }),
  ]);
  if (!categoryCount || !authorCount || !coverCount || tagCount !== new Set(tagIds).size || geoTagCount !== new Set(geoTagIds).size) {
    return { error: "En valgt kategori, forfatter, tag, geografi eller mediefil tilhører ikke denne CMS-instans." };
  }
  const data = {
    ...values.data,
    manchet: values.data.manchet || null,
    kategoriId: requestedCategoryId,
    forfatterId: requestedAuthorId,
    coverMediaId: requestedCoverMediaId,
    seoTitel: values.data.seoTitel || null,
    seoBeskrivelse: values.data.seoBeskrivelse || null,
    blocks: blocks.data as Prisma.InputJsonValue,
    aiBrug: aiBrug as Prisma.InputJsonValue,
    marking: marking === null ? Prisma.JsonNull : marking,
    status: nextStatus,
    // Forsidestyring (T5 P2-4): kun FRONTPAGE_EDIT må sætte "fastgjort"/"breaking". Andre bevarer den eksisterende værdi
    // (false ved ny artikel), så en forfatter ikke kan skubbe sin artikel i hero uden forsideredaktørens beslutning.
    pinned: canControlFrontpage ? formData.get("pinned") === "on" : current?.pinned ?? false,
    breaking: canControlFrontpage ? formData.get("breaking") === "on" : current?.breaking ?? false,
    publiceretTid: nextStatus === "Publiceret" ? current?.publiceretTid ?? new Date() : current?.publiceretTid,
    tags: { set: tagIds.map((id) => ({ id })) },
    geoTags: { set: geoTagIds.map((id) => ({ id })) },
  };

  try {
    let article;
    if (current && nextStatus === "Publiceret") {
      article = await db.$transaction(async (tx) => {
        const published = await tx.article.update({ where: { id: current.id }, data });
        const assignment = await tx.assignment.findUnique({ where: { articleId: published.id }, include: { assignedAuthor: { select: { forfatterType: true } } } });
        if (assignment?.assignedAuthorId) {
          await tx.assignment.update({ where: { id: assignment.id }, data: { status: "Godkendt", konfliktGennemgaaet: true } });
          if (assignment.assignedAuthor?.forfatterType === "Freelance") await tx.honorEntry.upsert({
            where: { assignmentId: assignment.id },
            update: {},
            create: {
              beloeb: honorAmountForAssignment(assignment), instansId: session.user.instansId,
              assignmentId: assignment.id, authorId: assignment.assignedAuthorId, articleId: published.id,
            },
          });
        }
        await tx.articleRevision.create({
          data: { articleId: published.id, userId: session.user.id, snapshot: JSON.parse(JSON.stringify(published)) as Prisma.InputJsonValue, note: "Publiceret" },
        });
        return published;
      });
    } else if (current && current.status !== nextStatus) {
      // Statusskift gemmes altid som revision (hvem, hvornår, fra/til) — også andre end publicering.
      article = await db.$transaction(async (tx) => {
        const updated = await tx.article.update({ where: { id: current.id }, data });
        await tx.articleRevision.create({
          data: { articleId: updated.id, userId: session.user.id, snapshot: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue, note: `Status: ${current.status} → ${nextStatus}` },
        });
        return updated;
      });
    } else if (current) {
      article = await db.article.update({ where: { id: current.id }, data });
    } else {
      const { tags: relationTags, geoTags: relationGeoTags, ...createData } = data;
      void relationTags;
      void relationGeoTags;
      article = await db.article.create({ data: {
        ...createData,
        instansId: session.user.instansId,
        tags: { connect: tagIds.map((id) => ({ id })) },
        geoTags: { connect: geoTagIds.map((id) => ({ id })) },
      } });
    }
    revalidatePath("/redaktion/artikler");
    revalidatePath(`/redaktion/artikler/${article.id}`);
    revalidatePath("/");
    if (nextStatus === "Publiceret" || current?.status === "Publiceret") void purgeInstance(session.user.instansId, [`/${article.slug}`]); // CDN-purge (no-op uden CF_API_TOKEN)
    if (!current) redirect(`/redaktion/artikler/${article.id}?created=1`);
    return { success: nextStatus === "Publiceret" ? "Artiklen er publiceret." : "Ændringerne er gemt." };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: "Sluggen bruges allerede af en anden artikel." };
    throw error;
  }
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
