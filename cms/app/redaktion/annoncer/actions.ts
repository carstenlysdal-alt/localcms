"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AD_MANAGE_PERMISSIONS } from "@/lib/redaktion-access";
import { cleanText, isHttpUrl } from "@/lib/validation/text";

const AD_PERMISSIONS = AD_MANAGE_PERMISSIONS;
const FORMATS = ["NATIVE_PREMIUM", "NATIVE_SEKTION", "IN_FEED_BANNER", "EVENT_POST", "GUIDE_PROFILE"] as const;
const ZONES = ["top", "feed", "artikel", "kalender"] as const;

const campaignSchema = z.object({
  titel: z.string().transform((v) => cleanText(v, 160)).pipe(z.string().min(2, "Titel og annoncør er påkrævet")),
  annoncoer: z.string().transform((v) => cleanText(v, 160)).pipe(z.string().min(2, "Titel og annoncør er påkrævet")),
  format: z.enum(FORMATS).catch("IN_FEED_BANNER"),
  placeringZone: z.enum(ZONES).catch("feed"),
  pris: z.coerce.number().int().min(0).max(10_000_000).catch(0),
  overskrift: z.string().transform((v) => cleanText(v, 200)),
  manchet: z.string().transform((v) => cleanText(v, 500)),
  ctaTekst: z.string().transform((v) => cleanText(v, 60) || "Læs mere"),
  linkUrl: z.string().transform((v) => v.trim()).refine((v) => isHttpUrl(v), "Annoncens link skal være en gyldig http(s)-URL"),
  badgeTekst: z.string().transform((v) => cleanText(v, 30) || "ANNONCE"),
  dageVarighed: z.coerce.number().int().min(1).max(365).catch(14),
});

export async function createCampaignAction(formData: FormData) {
  const user = await getAuthorizedUser(AD_PERMISSIONS);
  if (!user) throw new Error("Ingen adgang til at administrere annoncer");

  const parsed = campaignSchema.safeParse({
    titel: String(formData.get("titel") ?? ""),
    annoncoer: String(formData.get("annoncoer") ?? ""),
    format: formData.get("format") ?? undefined,
    placeringZone: formData.get("placeringZone") ?? undefined,
    pris: formData.get("pris") ?? 0,
    overskrift: String(formData.get("overskrift") ?? ""),
    manchet: String(formData.get("manchet") ?? ""),
    ctaTekst: String(formData.get("ctaTekst") ?? ""),
    linkUrl: String(formData.get("linkUrl") ?? ""),
    badgeTekst: String(formData.get("badgeTekst") ?? ""),
    dageVarighed: formData.get("dageVarighed") ?? 14,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Ugyldige annoncedata");
  const v = parsed.data;

  const startDato = new Date();
  const slutDato = new Date(startDato.getTime() + v.dageVarighed * 24 * 3600 * 1000);

  await db.adCampaign.create({
    data: {
      instansId: user.instansId,
      titel: v.titel,
      annoncoer: v.annoncoer,
      format: v.format,
      placeringZone: v.placeringZone,
      pris: v.pris,
      status: "Aktiv",
      startDato,
      slutDato,
      kreativData: { overskrift: v.overskrift || v.titel, manchet: v.manchet, ctaTekst: v.ctaTekst, linkUrl: v.linkUrl, badgeTekst: v.badgeTekst },
    },
  });

  revalidatePath("/redaktion/annoncer");
  revalidatePath("/");
}

export async function toggleCampaignStatusAction(campaignId: string, _currentStatus?: string) {
  const user = await getAuthorizedUser(AD_PERMISSIONS);
  if (!user) throw new Error("Ingen adgang til at administrere annoncer");

  // Status læses fra databasen — klientens `currentStatus` stoles ikke på.
  const campaign = await db.adCampaign.findFirst({ where: { id: String(campaignId), instansId: user.instansId }, select: { id: true, status: true } });
  if (!campaign) throw new Error("Kampagnen findes ikke");

  await db.adCampaign.updateMany({
    where: { id: campaign.id, instansId: user.instansId },
    data: { status: campaign.status === "Aktiv" ? "Pause" : "Aktiv" },
  });

  revalidatePath("/redaktion/annoncer");
  revalidatePath("/");
}

export async function deleteCampaignAction(campaignId: string) {
  const user = await getAuthorizedUser(AD_PERMISSIONS);
  if (!user) throw new Error("Ingen adgang til at administrere annoncer");

  const result = await db.adCampaign.deleteMany({ where: { id: String(campaignId), instansId: user.instansId } });
  if (result.count !== 1) throw new Error("Kampagnen findes ikke");

  revalidatePath("/redaktion/annoncer");
  revalidatePath("/");
}
