"use server";

import { revalidatePath } from "next/cache";
import { getFreshSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { calculateSupportedContentQuota } from "@/lib/frontpage-governance";
import { isCommercialType } from "@/lib/frontpage/types";

/** Gyldige zoner for fastgjorte artikler (Del 4 §4). */
const PIN_ZONES = ["top-hoved", "top-sekundaer", "omraade", "sektion"] as const;
const DEFAULT_PIN_HOURS = 48;
const MAX_PIN_HOURS = 24 * 30;

export async function pinArticleToZoneAction(formData: FormData) {
  const session = await getFreshSession();
  if (!session?.user) throw new Error("Ikke logget ind");
  if (!can(session.user, PERMISSIONS.FRONTPAGE_EDIT)) {
    throw new Error("Mangler rettighed til at redigere forsiden");
  }

  const articleId = formData.get("articleId") as string;
  const zone = String(formData.get("zone") || "top-hoved");
  const position = parseInt(String(formData.get("position") || "0"), 10);
  const durationHours = parseInt(String(formData.get("durationHours") || String(DEFAULT_PIN_HOURS)), 10);

  if (!articleId) throw new Error("Mangler artikel");
  if (!(PIN_ZONES as readonly string[]).includes(zone)) throw new Error("Ugyldig zone");
  if (!Number.isInteger(position) || position < 0 || position > 50) throw new Error("Ugyldig position");
  // En fastgørelse har ALTID et udløb (1 time – 30 dage); 0/negativt/ugyldigt giver ikke en permanent pin.
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > MAX_PIN_HOURS) throw new Error(`Varighed skal være 1–${MAX_PIN_HOURS} timer`);

  const article = await db.article.findFirst({
    where: { id: articleId, instansId: session.user.instansId },
  });
  if (!article) throw new Error("Artikel ikke fundet");
  if (article.status !== "Publiceret") throw new Error("Kun publicerede artikler kan fastgøres");

  // Kvoteloft-tjek hvis artiklen er kommerciel (samme definition som rækværk og applyPinsAction: Partner, Sponsoreret, PR, Annonce)
  if (isCommercialType(article.indholdstype)) {
    const quota = await calculateSupportedContentQuota(session.user.instansId);
    if (quota.isExceeded) {
      throw new Error(`Kvoteloft overskredet (${quota.percentage}% ≥ ${quota.kvoteloftProcent}%). Kommercielt indhold kan ikke fastgøres i topzonen.`);
    }
  }

  const udloebTid = new Date(Date.now() + durationHours * 3600 * 1000);

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
  const session = await getFreshSession();
  if (!session?.user) throw new Error("Ikke logget ind");
  if (!can(session.user, PERMISSIONS.FRONTPAGE_EDIT)) {
    throw new Error("Mangler rettighed til at redigere forsiden");
  }

  const removed = await db.frontpagePlacement.deleteMany({
    where: { id: placementId, instansId: session.user.instansId },
  });
  if (removed.count !== 1) throw new Error("Placeringen findes ikke");

  revalidatePath("/redaktion/forside");
  revalidatePath("/");
}
