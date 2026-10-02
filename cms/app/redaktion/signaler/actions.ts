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

/**
 * Godkend et maskinindsamlet signal til offentlig visning på forsiden (Fra kommunen/Fra politiet).
 * Kræver SIGNAL_APPROVE (slået op i databasen), er bundet til brugerens instans og registrerer hvem og hvornår.
 * Uden godkendelse vises et signal aldrig offentligt — heller ikke politi/112.
 */
export async function approveSignal(id: string) {
  const user = await getAuthorizedUser(PERMISSIONS.SIGNAL_APPROVE);
  if (!user) return { ok: false as const, error: "Du har ikke rettighed til at godkende signaler." };
  const res = await db.signal.updateMany({
    where: { id: String(id), instansId: user.instansId },
    data: { godkendtAf: user.id, godkendtTid: new Date(), laest: true },
  });
  if (res.count !== 1) return { ok: false as const, error: "Signalet findes ikke." };
  revalidatePath("/redaktion/signaler");
  revalidatePath("/");
  return { ok: true as const };
}

/** Træk en godkendelse tilbage: signalet forsvinder straks fra forsiden. */
export async function revokeSignalApproval(id: string) {
  const user = await getAuthorizedUser(PERMISSIONS.SIGNAL_APPROVE);
  if (!user) return { ok: false as const, error: "Du har ikke rettighed til at ændre godkendelser." };
  const res = await db.signal.updateMany({
    where: { id: String(id), instansId: user.instansId },
    data: { godkendtAf: null, godkendtTid: null },
  });
  if (res.count !== 1) return { ok: false as const, error: "Signalet findes ikke." };
  revalidatePath("/redaktion/signaler");
  revalidatePath("/");
  return { ok: true as const };
}

/** Formular-handling: godkend (hvis ikke godkendt) eller træk godkendelsen tilbage. Rettigheden tjekkes i approve/revoke. */
export async function toggleSignalApprovalAction(id: string, currentlyApproved: boolean): Promise<void> {
  if (currentlyApproved) await revokeSignalApproval(id);
  else await approveSignal(id);
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
