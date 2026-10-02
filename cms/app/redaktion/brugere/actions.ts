"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getAuthorizedUser, type AuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardAdminAction, requestIp } from "@/lib/admin-guard";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { PERMISSIONS } from "@/lib/permissions";
import { clearLoginFailures } from "@/lib/ratelimit";
import { cleanText } from "@/lib/validation/text";

/**
 * Brugeradministration (permission users.manage). Regler, der gælder ALLE actions her:
 *  - Rettigheden slås op i databasen ved hvert kald (getAuthorizedUser), aldrig i JWT'en.
 *  - Tenant-binding: instansId kommer altid fra den udførende admins DB-række; klienten sender aldrig instansId, og alle
 *    opslag på en målbruger filtrerer på `instansId` (en bruger i en anden instans er "findes ikke").
 *  - Ingen rettighedseskalering: man kan kun tildele roller, og kun røre brugere, hvis rolle ikke har flere rettigheder end ens egen.
 *  - Sidste administrator: den sidste aktive bruger med users.manage i instansen kan ikke nedgraderes eller deaktiveres.
 *  - Revisionsspor (AuditLog) uden hemmeligheder; rate limit pr. bruger + IP (fail-closed).
 *  - Midlertidige adgangskoder returneres ÉN gang i svaret; kun bcrypt-hashen gemmes. Aldrig logget.
 *  - Brugere slettes ikke (revisioner, opgaver og honorar peger på dem) — de deaktiveres.
 */

export type UserAdminResult = {
  ok: boolean;
  message: string;
  /** Kun ved ny bruger og nulstilling; vises én gang i UI'et. */
  tempPassword?: string;
  email?: string;
  name?: string;
  fieldErrors?: Partial<Record<"navn" | "email" | "roleId", string>>;
};

const DENIED: UserAdminResult = { ok: false, message: "Du har ikke adgang til brugeradministration." };
const NOT_FOUND: UserAdminResult = { ok: false, message: "Brugeren findes ikke i denne redaktion." };
const LAST_ADMIN: UserAdminResult = {
  ok: false,
  message: "Der skal altid være mindst én aktiv bruger, som kan administrere brugere. Giv først en anden bruger den rolle.",
};

const SERIALIZABLE = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

function permissionsOf(role: { permissions: unknown }): string[] {
  return Array.isArray(role.permissions) ? (role.permissions as string[]) : [];
}

/** Må udføreren røre/tildele en rolle? Kun hvis rollens rettigheder er en delmængde af udførerens egne. */
function withinReach(actor: AuthorizedUser, role: { permissions: unknown }): boolean {
  const own = new Set(actor.permissions);
  return permissionsOf(role).every((p) => own.has(p));
}

function isAdminRole(role: { permissions: unknown }): boolean {
  return permissionsOf(role).includes(PERMISSIONS.USERS_MANAGE);
}

async function otherActiveAdmins(tx: Prisma.TransactionClient, instansId: string, excludeUserId: string): Promise<number> {
  const users = await tx.user.findMany({
    where: { instansId, deaktiveretTid: null, id: { not: excludeUserId } },
    select: { role: { select: { permissions: true } } },
  });
  return users.filter((u) => isAdminRole(u.role)).length;
}

async function begin(): Promise<{ actor: AuthorizedUser; ip: string } | { error: UserAdminResult }> {
  const actor = await getAuthorizedUser(PERMISSIONS.USERS_MANAGE);
  if (!actor) return { error: DENIED };
  const limited = await guardAdminAction({ action: "users", userId: actor.id, limit: 60 });
  if (limited) return { error: { ok: false, message: limited } };
  return { actor, ip: await requestIp() };
}

/** Tungere handlinger (bcrypt + nyt hemmeligt) har en strammere grænse. */
async function guardSecretIssue(actor: AuthorizedUser): Promise<UserAdminResult | null> {
  const limited = await guardAdminAction({ action: "users-secret", userId: actor.id, limit: 15 });
  return limited ? { ok: false, message: limited } : null;
}

function isTxConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002");
}

const createSchema = z.object({
  navn: z.string().min(2, "Skriv et navn (mindst 2 tegn).").max(120),
  email: z.string().email("Skriv en gyldig e-mailadresse.").max(254),
  roleId: z.string().min(1, "Vælg en rolle."),
});

export async function createUserAction(formData: FormData): Promise<UserAdminResult> {
  const started = await begin();
  if ("error" in started) return started.error;
  const { actor, ip } = started;
  const limited = await guardSecretIssue(actor);
  if (limited) return limited;

  const parsed = createSchema.safeParse({
    navn: cleanText(formData.get("navn"), 120),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    roleId: String(formData.get("roleId") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: NonNullable<UserAdminResult["fieldErrors"]> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as "navn" | "email" | "roleId"] ??= issue.message;
    return { ok: false, message: "Ret felterne nedenfor.", fieldErrors };
  }
  const { navn, email, roleId } = parsed.data;

  const role = await db.role.findUnique({ where: { id: roleId } });
  if (!role || !withinReach(actor, role)) return { ok: false, message: "Rollen kan ikke vælges.", fieldErrors: { roleId: "Vælg en af de viste roller." } };
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, message: "Ret felterne nedenfor.", fieldErrors: { email: "Der findes allerede en bruger med denne e-mail." } };
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  try {
    // instansId fra udførerens egen række — aldrig fra klienten.
    const created = await db.user.create({
      data: { email, navn, passwordHash, roleId: role.id, instansId: actor.instansId, mustChangePassword: true },
      select: { id: true },
    });
    await writeAudit(db, {
      instansId: actor.instansId,
      actorId: actor.id,
      actorLabel: actor.email,
      action: "user.create",
      targetId: created.id,
      targetLabel: email,
      detail: { role: role.navn },
      ip,
    });
  } catch (error) {
    if (isTxConflict(error)) return { ok: false, message: "Ret felterne nedenfor.", fieldErrors: { email: "Der findes allerede en bruger med denne e-mail." } };
    throw error;
  }
  revalidatePath("/redaktion/brugere");
  return { ok: true, message: `Brugeren ${navn} er oprettet.`, tempPassword, email, name: navn };
}

export async function resetPasswordAction(userId: string): Promise<UserAdminResult> {
  const started = await begin();
  if ("error" in started) return started.error;
  const { actor, ip } = started;
  const limited = await guardSecretIssue(actor);
  if (limited) return limited;

  const id = String(userId ?? "");
  if (id === actor.id) return { ok: false, message: "Skift din egen adgangskode under Min konto." };
  const target = await db.user.findFirst({ where: { id, instansId: actor.instansId }, include: { role: true } });
  if (!target) return NOT_FOUND;
  if (!withinReach(actor, target.role)) return { ok: false, message: "Du kan ikke ændre en bruger med flere rettigheder end dig selv." };
  if (target.deaktiveretTid) return { ok: false, message: "Brugeren er deaktiveret. Aktivér brugeren, før adgangskoden nulstilles." };

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const now = new Date();
  // passwordChangedAt = nu: brugerens eksisterende sessioner afvises (lib/session-validity.ts).
  const updated = await db.user.updateMany({
    where: { id: target.id, instansId: actor.instansId },
    data: { passwordHash, mustChangePassword: true, passwordChangedAt: now },
  });
  if (updated.count !== 1) return NOT_FOUND;
  await clearLoginFailures(target.email);
  await writeAudit(db, { instansId: actor.instansId, actorId: actor.id, actorLabel: actor.email, action: "user.reset_password", targetId: target.id, targetLabel: target.email, ip });
  revalidatePath("/redaktion/brugere");
  return { ok: true, message: `Adgangskoden for ${target.navn} er nulstillet, og vedkommende er logget ud overalt.`, tempPassword, email: target.email, name: target.navn };
}

export async function changeRoleAction(userId: string, roleId: string): Promise<UserAdminResult> {
  const started = await begin();
  if ("error" in started) return started.error;
  const { actor, ip } = started;

  try {
    return await db.$transaction(async (tx): Promise<UserAdminResult> => {
      const target = await tx.user.findFirst({ where: { id: String(userId ?? ""), instansId: actor.instansId }, include: { role: true } });
      if (!target) return NOT_FOUND;
      const newRole = await tx.role.findUnique({ where: { id: String(roleId ?? "") } });
      if (!newRole) return { ok: false, message: "Rollen findes ikke." };
      if (newRole.id === target.roleId) return { ok: true, message: "Rollen er uændret." };
      if (!withinReach(actor, target.role)) return { ok: false, message: "Du kan ikke ændre en bruger med flere rettigheder end dig selv." };
      if (!withinReach(actor, newRole)) return { ok: false, message: "Du kan ikke give en rolle med flere rettigheder, end du selv har." };
      if (!target.deaktiveretTid && isAdminRole(target.role) && !isAdminRole(newRole) && (await otherActiveAdmins(tx, actor.instansId, target.id)) === 0) return LAST_ADMIN;

      await tx.user.update({ where: { id: target.id }, data: { roleId: newRole.id } });
      await writeAudit(tx, {
        instansId: actor.instansId,
        actorId: actor.id,
        actorLabel: actor.email,
        action: "user.change_role",
        targetId: target.id,
        targetLabel: target.email,
        detail: { fromRole: target.role.navn, toRole: newRole.navn },
        ip,
      });
      return { ok: true, message: `${target.navn} har nu rollen ${newRole.navn}.` };
    }, SERIALIZABLE);
  } catch (error) {
    if (isTxConflict(error)) return { ok: false, message: "Ændringen kolliderede med en anden ændring. Prøv igen." };
    throw error;
  } finally {
    revalidatePath("/redaktion/brugere");
  }
}

async function setActive(userId: string, active: boolean): Promise<UserAdminResult> {
  const started = await begin();
  if ("error" in started) return started.error;
  const { actor, ip } = started;
  const id = String(userId ?? "");
  if (!active && id === actor.id) return { ok: false, message: "Du kan ikke deaktivere dig selv." };

  try {
    return await db.$transaction(async (tx): Promise<UserAdminResult> => {
      const target = await tx.user.findFirst({ where: { id, instansId: actor.instansId }, include: { role: true } });
      if (!target) return NOT_FOUND;
      if (!withinReach(actor, target.role)) return { ok: false, message: "Du kan ikke ændre en bruger med flere rettigheder end dig selv." };
      if (active === !target.deaktiveretTid) return { ok: true, message: active ? "Brugeren er allerede aktiv." : "Brugeren er allerede deaktiveret." };
      if (!active && isAdminRole(target.role) && (await otherActiveAdmins(tx, actor.instansId, target.id)) === 0) return LAST_ADMIN;

      await tx.user.update({ where: { id: target.id }, data: { deaktiveretTid: active ? null : new Date() } });
      await writeAudit(tx, { instansId: actor.instansId, actorId: actor.id, actorLabel: actor.email, action: active ? "user.reactivate" : "user.deactivate", targetId: target.id, targetLabel: target.email, ip });
      return { ok: true, message: active ? `${target.navn} er aktiveret igen.` : `${target.navn} er deaktiveret og kan ikke længere logge ind.` };
    }, SERIALIZABLE);
  } catch (error) {
    if (isTxConflict(error)) return { ok: false, message: "Ændringen kolliderede med en anden ændring. Prøv igen." };
    throw error;
  } finally {
    revalidatePath("/redaktion/brugere");
  }
}

export async function deactivateUserAction(userId: string): Promise<UserAdminResult> {
  return setActive(userId, false);
}

export async function reactivateUserAction(userId: string): Promise<UserAdminResult> {
  return setActive(userId, true);
}
