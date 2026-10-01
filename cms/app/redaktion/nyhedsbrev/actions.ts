"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { cleanText } from "@/lib/validation/text";
import { generateToken } from "@/lib/validation/tokens";
import { emailSchema } from "@/lib/validation/public";

const DENIED = { success: false, error: "Ikke autoriseret" } as const;

export async function toggleSubscriberStatus(subscriberId: string) {
  const user = await getAuthorizedUser(PERMISSIONS.NEWSLETTER_MANAGE);
  if (!user) return DENIED;

  const sub = await db.newsletterSubscriber.findFirst({
    where: { id: String(subscriberId), instansId: user.instansId },
  });
  if (!sub) return { success: false, error: "Abonnenten blev ikke fundet" };

  const nextStatus = !sub.aktiv;
  await db.newsletterSubscriber.updateMany({
    where: { id: sub.id, instansId: user.instansId },
    data: { aktiv: nextStatus, afmeldtTid: nextStatus ? null : new Date() },
  });

  revalidatePath("/redaktion/nyhedsbrev");
  return { success: true };
}

export async function deleteSubscriber(subscriberId: string) {
  const user = await getAuthorizedUser(PERMISSIONS.NEWSLETTER_MANAGE);
  if (!user) return DENIED;

  await db.newsletterSubscriber.deleteMany({
    where: { id: String(subscriberId), instansId: user.instansId },
  });

  revalidatePath("/redaktion/nyhedsbrev");
  return { success: true };
}

export async function addSubscriberManual(formData: FormData) {
  const user = await getAuthorizedUser(PERMISSIONS.NEWSLETTER_MANAGE);
  if (!user) return DENIED;

  const parsedEmail = emailSchema.safeParse(formData.get("email")?.toString() ?? "");
  if (!parsedEmail.success) return { success: false, error: "Angiv en gyldig e-mailadresse." };
  const email = parsedEmail.data;
  const navn = cleanText(formData.get("navn")?.toString() ?? "", 100) || null;
  const omraadeRaw = cleanText(formData.get("omraadeSlug")?.toString() ?? "", 80);
  const omraadeSlug = /^[\p{L}\p{N}-]+$/u.test(omraadeRaw) ? omraadeRaw : null;

  const existing = await db.newsletterSubscriber.findFirst({ where: { instansId: user.instansId, email } });

  if (existing) {
    await db.newsletterSubscriber.updateMany({
      where: { id: existing.id, instansId: user.instansId },
      data: { aktiv: true, afmeldtTid: null, navn: navn || existing.navn },
    });
  } else {
    await db.newsletterSubscriber.create({
      data: { email, navn, omraadeSlug, aktiv: true, bekraeftetTid: new Date(), afmeldingsToken: generateToken(), instansId: user.instansId },
    });
  }

  revalidatePath("/redaktion/nyhedsbrev");
  return { success: true };
}
