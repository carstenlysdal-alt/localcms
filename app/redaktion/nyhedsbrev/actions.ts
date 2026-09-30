"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function toggleSubscriberStatus(subscriberId: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Ikke autoriseret" };
  }

  const sub = await db.newsletterSubscriber.findFirst({
    where: { id: subscriberId, instansId: session.user.instansId },
  });

  if (!sub) {
    return { success: false, error: "Abonnenten blev ikke fundet" };
  }

  const nextStatus = !sub.aktiv;
  await db.newsletterSubscriber.update({
    where: { id: subscriberId },
    data: {
      aktiv: nextStatus,
      afmeldtTid: nextStatus ? null : new Date(),
    },
  });

  revalidatePath("/redaktion/nyhedsbrev");
  return { success: true };
}

export async function deleteSubscriber(subscriberId: string) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Ikke autoriseret" };
  }

  await db.newsletterSubscriber.deleteMany({
    where: { id: subscriberId, instansId: session.user.instansId },
  });

  revalidatePath("/redaktion/nyhedsbrev");
  return { success: true };
}

export async function addSubscriberManual(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { success: false, error: "Ikke autoriseret" };
  }

  const email = formData.get("email")?.toString().trim().toLowerCase();
  const navn = formData.get("navn")?.toString().trim() || null;
  const omraadeSlug = formData.get("omraadeSlug")?.toString().trim() || null;

  if (!email || !email.includes("@")) {
    return { success: false, error: "Angiv en gyldig e-mailadresse." };
  }

  const existing = await db.newsletterSubscriber.findFirst({
    where: { instansId: session.user.instansId, email },
  });

  if (existing) {
    await db.newsletterSubscriber.update({
      where: { id: existing.id },
      data: { aktiv: true, afmeldtTid: null, navn: navn || existing.navn },
    });
  } else {
    await db.newsletterSubscriber.create({
      data: {
        email,
        navn,
        omraadeSlug,
        aktiv: true,
        bekraeftetTid: new Date(),
        instansId: session.user.instansId,
      },
    });
  }

  revalidatePath("/redaktion/nyhedsbrev");
  return { success: true };
}
