"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { calculateSupportedContentQuota } from "@/lib/frontpage-governance";

export async function pinArticleToZoneAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Ikke logget ind");
  if (!can(session.user, PERMISSIONS.FRONTPAGE_EDIT)) {
    throw new Error("Mangler rettighed til at redigere forsiden");
  }

  const articleId = formData.get("articleId") as string;
  const zone = (formData.get("zone") as string) || "top-hoved";
  const position = parseInt((formData.get("position") as string) || "0", 10);
  const durationHours = parseInt((formData.get("durationHours") as string) || "48", 10);

  if (!articleId) throw new Error("Mangler artikel");

  const article = await db.article.findUnique({
    where: { id: articleId },
  });
  if (!article) throw new Error("Artikel ikke fundet");

  // Kvoteloft-tjek hvis artiklen er kommerciel
  const isCommercial = article.indholdstype === "Partner" || article.indholdstype === "Sponsoreret";
  if (isCommercial) {
    const quota = await calculateSupportedContentQuota(session.user.instansId);
    if (quota.isExceeded) {
      throw new Error(`Kvoteloft overskredet (${quota.percentage}% ≥ ${quota.kvoteloftProcent}%). Kommercielt indhold kan ikke fastgøres i topzonen.`);
    }
  }

  const udloebTid = durationHours > 0 ? new Date(Date.now() + durationHours * 3600 * 1000) : null;

  // Fjern evt. eksisterende placering af samme artikel
  await db.frontpagePlacement.deleteMany({
    where: { articleId, instansId: session.user.instansId },
  });

  // Hvis zone er "top-hoved", fjern tidligere hovedartikel
  if (zone === "top-hoved") {
    await db.frontpagePlacement.deleteMany({
      where: { zone: "top-hoved", instansId: session.user.instansId },
    });
  }

  await db.frontpagePlacement.create({
    data: {
      instansId: session.user.instansId,
      articleId,
      zone,
      position,
      udloebTid,
    },
  });

  revalidatePath("/redaktion/forside");
  revalidatePath("/");
}

export async function removePlacementAction(placementId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Ikke logget ind");
  if (!can(session.user, PERMISSIONS.FRONTPAGE_EDIT)) {
    throw new Error("Mangler rettighed til at redigere forsiden");
  }

  await db.frontpagePlacement.delete({
    where: { id: placementId },
  });

  revalidatePath("/redaktion/forside");
  revalidatePath("/");
}
