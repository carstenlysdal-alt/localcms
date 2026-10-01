"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function createCampaignAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Ikke logget ind");

  const titel = (formData.get("titel") as string)?.trim();
  const annoncoer = (formData.get("annoncoer") as string)?.trim();
  const format = (formData.get("format") as string) || "IN_FEED_BANNER";
  const placeringZone = (formData.get("placeringZone") as string) || "feed";
  const pris = parseInt((formData.get("pris") as string) || "0", 10);
  const overskrift = (formData.get("overskrift") as string)?.trim() || titel;
  const manchet = (formData.get("manchet") as string)?.trim() || "";
  const ctaTekst = (formData.get("ctaTekst") as string)?.trim() || "Læs mere";
  const linkUrl = (formData.get("linkUrl") as string)?.trim() || "https://";
  const badgeTekst = (formData.get("badgeTekst") as string)?.trim() || "ANNONCE";
  const dageVarighed = parseInt((formData.get("dageVarighed") as string) || "14", 10);

  if (!titel || !annoncoer) {
    throw new Error("Titel og annoncør er påkrævet");
  }

  const startDato = new Date();
  const slutDato = new Date(startDato.getTime() + dageVarighed * 24 * 3600 * 1000);

  await db.adCampaign.create({
    data: {
      instansId: session.user.instansId,
      titel,
      annoncoer,
      format,
      placeringZone,
      pris,
      status: "Aktiv",
      startDato,
      slutDato,
      kreativData: {
        overskrift,
        manchet,
        ctaTekst,
        linkUrl,
        badgeTekst,
      },
    },
  });

  revalidatePath("/redaktion/annoncer");
  revalidatePath("/");
}

export async function toggleCampaignStatusAction(campaignId: string, currentStatus: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Ikke logget ind");

  const newStatus = currentStatus === "Aktiv" ? "Pause" : "Aktiv";
  await db.adCampaign.update({
    where: { id: campaignId },
    data: { status: newStatus },
  });

  revalidatePath("/redaktion/annoncer");
  revalidatePath("/");
}

export async function deleteCampaignAction(campaignId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Ikke logget ind");

  await db.adCampaign.delete({
    where: { id: campaignId },
  });

  revalidatePath("/redaktion/annoncer");
  revalidatePath("/");
}
