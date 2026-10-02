"use server";

import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { compare } from "bcryptjs";
import { z } from "zod";
import { getAuthorizedUser, signIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { guardAdminAction, requestIp } from "@/lib/admin-guard";
import { hashPassword } from "@/lib/password";
import { validatePassword } from "@/lib/password-policy";
import { clearPasswordChangeFailures, isPasswordChangeLocked, recordPasswordChangeFailure } from "@/lib/ratelimit";

export type ChangePasswordState = {
  ok?: boolean;
  /** Samlet fejl- eller statusbesked (aldrig adgangskoder). */
  message?: string;
  /** Feltfejl pr. felt: current | next | confirm. */
  errors?: Partial<Record<"current" | "next" | "confirm", string[]>>;
  /** True hvis den nye session ikke kunne udstedes automatisk — brugeren skal logge ind igen. */
  relogin?: boolean;
};

const MSG_GENERIC = "Adgangskoden kunne ikke skiftes. Prøv igen.";
const MSG_LOCKED = "For mange forkerte forsøg. Vent 15 minutter, og prøv igen.";

const inputSchema = z.object({
  current: z.string().min(1, "Skriv din nuværende adgangskode.").max(200),
  next: z.string().min(1, "Skriv en ny adgangskode.").max(200),
  confirm: z.string().max(200),
});

/**
 * Skift egen adgangskode (Min konto og tvungen første-login-skift).
 *
 *  - getAuthorizedUser med allowPasswordChange: det ER den eneste action, en bruger med midlertidig kode må kalde.
 *  - Rate limit pr. bruger + IP (fail-closed) og lockout efter 5 forkerte "nuværende adgangskode"-forsøg.
 *  - bcrypt.compare (konstant tid) mod den gemte hash; ny kode valideres af lib/password-policy.ts.
 *  - Ved succes: passwordChangedAt = nu → alle ANDRE sessioner (JWT udstedt før) afvises; den nuværende session
 *    erstattes af en ny, så brugeren forbliver logget ind. Adgangskoder returneres/logges aldrig.
 */
export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const user = await getAuthorizedUser(undefined, { allowPasswordChange: true });
  if (!user) return { message: "Din session er udløbet. Log ind igen." };

  const limited = await guardAdminAction({ action: "password-change", userId: user.id, limit: 20, windowMs: 15 * 60_000 });
  if (limited) return { message: limited };

  const parsed = inputSchema.safeParse({
    current: formData.get("current") ?? "",
    next: formData.get("next") ?? "",
    confirm: formData.get("confirm") ?? "",
  });
  if (!parsed.success) {
    const errors: NonNullable<ChangePasswordState["errors"]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "current" | "next" | "confirm";
      (errors[key] ??= []).push(issue.message);
    }
    return { message: "Ret felterne nedenfor.", errors };
  }
  const { current, next, confirm } = parsed.data;

  const ip = await requestIp();
  if (await isPasswordChangeLocked(user.id, ip)) return { message: MSG_LOCKED };

  const row = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true, email: true, navn: true } });
  if (!row) return { message: MSG_GENERIC };

  // bcrypt.compare er konstant-tid over hashen; kontrolleres FØR vi røber noget om den nye kodes gyldighed.
  if (!(await compare(current.slice(0, 200), row.passwordHash))) {
    await recordPasswordChangeFailure(user.id, ip);
    return { message: "Ret felterne nedenfor.", errors: { current: ["Den nuværende adgangskode er forkert."] } };
  }
  await clearPasswordChangeFailures(user.id);

  const errors: NonNullable<ChangePasswordState["errors"]> = {};
  const policy = validatePassword(next, { email: row.email, name: row.navn, current });
  if (policy.length) errors.next = policy;
  if (next !== confirm) errors.confirm = ["De to nye adgangskoder er ikke ens."];
  if (errors.next || errors.confirm) return { message: "Ret felterne nedenfor.", errors };

  const passwordHash = await hashPassword(next);
  const now = new Date();
  // Optimistisk lås på den gamle hash: ændrer en anden session koden samtidig, vinder kun én.
  const updated = await db.user.updateMany({
    where: { id: user.id, passwordHash: row.passwordHash },
    data: { passwordHash, passwordChangedAt: now, mustChangePassword: false },
  });
  if (updated.count !== 1) return { message: "Adgangskoden blev ændret fra en anden session imens. Prøv igen." };

  await writeAudit(db, {
    instansId: user.instansId,
    actorId: user.id,
    actorLabel: row.email,
    action: "password.change",
    targetId: user.id,
    targetLabel: row.email,
    detail: { forced: user.mustChangePassword },
    ip,
  });

  // Udsted en frisk session (authTime ≥ passwordChangedAt), så denne browser fortsætter, mens alle ældre sessioner dør.
  let relogin = false;
  try {
    await signIn("credentials", { email: row.email, password: next, redirect: false });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    relogin = true;
  }

  revalidatePath("/redaktion", "layout");
  return relogin
    ? { ok: true, relogin: true, message: "Adgangskoden er skiftet. Log ind igen med den nye adgangskode." }
    : { ok: true, message: "Adgangskoden er skiftet. Andre enheder, hvor du var logget ind, er logget ud." };
}
