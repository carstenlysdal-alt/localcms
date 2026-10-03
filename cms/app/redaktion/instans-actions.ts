"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedUser, updateSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardAdminAction, requestIp } from "@/lib/admin-guard";
import { accessibleInstanceIds } from "@/lib/instance-access";

/**
 * Skift af aktiv by (netværksadgang: ét login til flere byer). Den ENESTE vej til at ændre den aktive instans i sessionen.
 *
 *  - Kræver en frisk DB-session (getAuthorizedUser: slettet/deaktiveret bruger, kodeskift og tvungen kodeskift afvises).
 *  - Instansen kommer fra et argument, men gælder kun hvis den er brugerens hjem eller en adgangsrække findes i databasen
 *    lige nu; derefter skriver Auth.js' update-trigger claimen, og jwt-callbacken genvaliderer mod databasen igen.
 *  - Rate limit pr. bruger + IP (fail-closed). Revisionsspor i målbyen (fra/til, ingen hemmeligheder).
 *  - Klienten sender aldrig en instans i andre requests: alt andet bruger den aktive instans fra den friske session.
 */
export type SwitchInstanceResult = { ok: boolean; message: string; instansId?: string; navn?: string };

const DENIED: SwitchInstanceResult = { ok: false, message: "Du har ikke adgang til den by." };

export async function switchInstance(instansId: string): Promise<SwitchInstanceResult> {
  const user = await getAuthorizedUser();
  if (!user) return { ok: false, message: "Du er ikke logget ind." };
  const target = typeof instansId === "string" ? instansId.trim() : "";
  if (!target || target.length > 64) return DENIED;

  const limited = await guardAdminAction({ action: "instance-switch", userId: user.id, limit: 30 });
  if (limited) return { ok: false, message: limited };

  const allowed = await accessibleInstanceIds(user.id, user.homeInstansId);
  if (!allowed.includes(target)) return DENIED;
  const instance = await db.instance.findUnique({ where: { id: target }, select: { id: true, navn: true } });
  if (!instance) return DENIED;
  if (target === user.instansId) return { ok: true, message: `Du redigerer allerede ${instance.navn}.`, instansId: target, navn: instance.navn };

  try {
    await updateSession({ user: { activeInstansId: target } });
  } catch {
    return { ok: false, message: "Kunne ikke skifte by. Prøv igen." };
  }
  await writeAudit(db, {
    instansId: target,
    actorId: user.id,
    actorLabel: user.email,
    action: "instance.switch",
    targetId: target,
    targetLabel: instance.navn,
    detail: { from: user.instansId, to: target },
    ip: await requestIp(),
  });
  revalidatePath("/redaktion", "layout");
  return { ok: true, message: `Du redigerer nu ${instance.navn}.`, instansId: target, navn: instance.navn };
}
