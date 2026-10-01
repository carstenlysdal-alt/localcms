"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERMISSIONS } from "@/lib/permissions";
import { cleanText, isHttpUrl } from "@/lib/validation/text";

export async function markAllRead() {
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_CREATE);
  if (!user) return;
  await db.signal.updateMany({ where: { instansId: user.instansId, laest: false }, data: { laest: true } });
  revalidatePath("/redaktion/signaler");
}

export async function markRead(id: string) {
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_CREATE);
  if (!user) return;
  // Tenant-binding: updateMany med instansId (update ville kunne ramme andre byers signaler).
  await db.signal.updateMany({ where: { id: String(id), instansId: user.instansId }, data: { laest: true } });
  revalidatePath("/redaktion/signaler");
}

export async function createSignal(data: FormData) {
  const user = await getAuthorizedUser(PERMISSIONS.ARTICLE_CREATE);
  if (!user) return;
  const overskrift = cleanText(String(data.get("overskrift") ?? ""), 300);
  if (!overskrift) return;
  const kildeUrl = String(data.get("kildeUrl") ?? "").trim();
  await db.signal.create({
    data: {
      overskrift,
      brødtekst: cleanText(String(data.get("brødtekst") ?? ""), 5000, { multiline: true }) || null,
      kilde: cleanText(String(data.get("kilde") ?? ""), 120) || "Intern",
      kildeUrl: isHttpUrl(kildeUrl) ? kildeUrl : null,
      notable: data.get("notable") === "on",
      breaking: data.get("breaking") === "on",
      instansId: user.instansId,
    },
  });
  revalidatePath("/redaktion/signaler");
}
