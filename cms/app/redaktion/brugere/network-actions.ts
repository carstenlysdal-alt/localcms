"use server";

import { revalidatePath } from "next/cache";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { guardAdminAction, requestIp } from "@/lib/admin-guard";
import { accessibleInstanceIds, applyAccessChange, planAccessChange } from "@/lib/instance-access";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * Netværksadgang for andre brugere (permission network.manage — IKKE users.manage alene). Regler:
 *  - Rettigheden og udførerens egne byer slås op i databasen ved hvert kald; klienten sender kun en liste af instans-id'er.
 *  - Udføreren kan kun TILFØJE eller FJERNE byer, udføreren selv har adgang til (planAccessChange) — aldrig en tredje by.
 *  - Målbrugeren skal have den aktive by som hjemmeby (samme afgrænsning som resten af brugeradministrationen) og må ikke have
 *    flere rettigheder end udføreren (samme rækkevidde-regel som roller). Man kan ikke ændre sin egen adgang.
 *  - Hjemmebyen kan hverken gives eller fjernes: en bruger beholder altid mindst den.
 *  - Revisionsspor pr. ændring (i den berørte by). Ikke tilgængelig for AI-operatøren (lib/operator/policy.ts BLOCKED_TOOLS).
 * Filen importeres bevidst IKKE fra lib/operator (guard-test).
 */
export type NetworkAccessResult = { ok: boolean; message: string; instansIds?: string[] };

const DENIED: NetworkAccessResult = { ok: false, message: "Du har ikke adgang til at give adgang til andre byer." };

export async function setUserInstanceAccessAction(userId: string, instanceIds: string[]): Promise<NetworkAccessResult> {
  const actor = await getAuthorizedUser(PERMISSIONS.NETWORK_MANAGE);
  if (!actor) return DENIED;
  const limited = await guardAdminAction({ action: "users-network", userId: actor.id, limit: 30 });
  if (limited) return { ok: false, message: limited };
  if (!Array.isArray(instanceIds) || instanceIds.length > 50 || instanceIds.some((id) => typeof id !== "string" || id.length === 0 || id.length > 64)) {
    return { ok: false, message: "Ugyldigt valg af byer." };
  }
  const id = String(userId ?? "");
  if (id === actor.id) return { ok: false, message: "Du kan ikke ændre din egen adgang." };

  const target = await db.user.findFirst({ where: { id, instansId: actor.instansId }, include: { role: true } });
  if (!target) return { ok: false, message: "Brugeren findes ikke i denne redaktion." };
  const own = new Set(actor.permissions);
  const targetPerms = Array.isArray(target.role.permissions) ? (target.role.permissions as string[]) : [];
  if (!targetPerms.every((p) => own.has(p))) return { ok: false, message: "Du kan ikke ændre en bruger med flere rettigheder end dig selv." };

  const actorAccessible = await accessibleInstanceIds(actor.id, actor.homeInstansId);
  const existing = await db.instance.findMany({ where: { id: { in: instanceIds } }, select: { id: true } });
  if (existing.length !== new Set(instanceIds).size) return { ok: false, message: "Ugyldigt valg af byer." };

  const ip = await requestIp();
  const result = await db.$transaction(async (tx): Promise<NetworkAccessResult> => {
    const current = (await tx.userInstanceAccess.findMany({ where: { userId: target.id }, select: { instansId: true } })).map((r) => r.instansId);
    const plan = planAccessChange({ actorAccessible, targetHome: target.instansId, current, desired: instanceIds });
    if (!plan.ok) return { ok: false, message: "Du kan kun give eller fjerne adgang til byer, du selv har adgang til." };
    const { added, removed } = await applyAccessChange(tx, {
      target: { id: target.id, email: target.email },
      add: plan.add,
      remove: plan.remove,
      actor: { id: actor.id, label: actor.email, ip },
      source: "ui",
    });
    const finalIds = (await tx.userInstanceAccess.findMany({ where: { userId: target.id }, select: { instansId: true } })).map((r) => r.instansId);
    return {
      ok: true,
      message: added.length + removed.length === 0 ? "Adgangen er uændret." : `Adgangen for ${target.navn} er opdateret (${added.length} tilføjet, ${removed.length} fjernet). Ændringen gælder ved næste forespørgsel.`,
      instansIds: finalIds,
    };
  });
  revalidatePath("/redaktion/brugere");
  return result;
}
