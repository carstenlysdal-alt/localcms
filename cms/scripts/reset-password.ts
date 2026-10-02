/**
 * Nødadgang: nulstil en brugers adgangskode fra serveren (fx hvis ejeren er låst ude).
 *
 *   npm run user:reset-password -- --email <e-mail>            # kræver NODE_ENV=production (sat på Railway-servicen)
 *   npm run user:reset-password -- --email <e-mail> --force    # fx via `railway run`, hvor NODE_ENV ikke er sat
 *
 * Udskriver en ny midlertidig adgangskode ÉN gang til stdout (gem den i en password manager). Sætter
 * mustChangePassword=true (brugeren vælger en ny ved login) og passwordChangedAt=nu (alle eksisterende sessioner dør).
 * Lockout efter forkerte logins udløber af sig selv efter 15 minutter. Skriver en post i revisionssporet (AuditLog) uden hemmeligheder.
 * Env: DATABASE_URL (postgresql://…).
 */
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { writeAudit } from "../lib/audit";
import { generateTempPassword, hashPassword } from "../lib/password";

export type ResetResult = { email: string; password: string };

export async function resetPassword(db: PrismaClient, emailInput: string): Promise<ResetResult> {
  const email = z.string().email().parse(emailInput).toLowerCase().trim();
  const user = await db.user.findUnique({ where: { email }, select: { id: true, instansId: true } });
  if (!user) throw new Error(`Ingen bruger med e-mailen ${email}.`);
  const password = generateTempPassword();
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), mustChangePassword: true, passwordChangedAt: new Date() },
  });
  await writeAudit(db, { instansId: user.instansId, actorId: null, actorLabel: null, action: "user.reset_password_cli", targetId: user.id, targetLabel: email });
  return { email, password };
}

/** Rene argumenter (testbar): returnerer e-mailen eller kaster. */
export function parseArgs(argv: string[]): { email: string; force: boolean } {
  const force = argv.includes("--force");
  const index = argv.indexOf("--email");
  const email = index >= 0 ? argv[index + 1] : undefined;
  if (!email || email.startsWith("--")) throw new Error("--email <e-mail> mangler.");
  return { email, force };
}

async function main() {
  const force = process.argv.includes("--force");
  if (process.env.NODE_ENV !== "production" && !force) {
    console.error("[user:reset-password] Afvist: NODE_ENV er ikke 'production'. Brug --force, hvis du bevidst kører mod produktionsdatabasen (fx via railway run).");
    process.exit(1);
  }
  if (!/^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL ?? "")) {
    console.error("[user:reset-password] Afvist: DATABASE_URL skal være en postgresql://-URL.");
    process.exit(1);
  }
  const args = parseArgs(process.argv.slice(2));
  const { db } = await import("../lib/db");
  try {
    const res = await resetPassword(db, args.email);
    console.log(`[user:reset-password] ny midlertidig adgangskode til ${res.email} (vises kun nu — brugeren skal vælge en ny ved login):`);
    console.log(res.password);
  } finally {
    await db.$disconnect();
  }
}

if (path.basename(process.argv[1] ?? "") === "reset-password.ts") {
  main().catch((err) => {
    console.error(`[user:reset-password] Fejl: ${(err as Error).message}`);
    process.exit(1);
  });
}
