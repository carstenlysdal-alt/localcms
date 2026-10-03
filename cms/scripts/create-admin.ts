/**
 * Opretter en administrator (rolle "Ansvarshavende redaktør") i ÉN bestemt by — fx når ejeren skal have et login pr. by,
 * mens alle seks byer ligger på samme Railway-adresse.
 *
 *   npm run user:create-admin -- --instans <id|domæne> --email <e-mail> [--navn <navn>]            # kræver NODE_ENV=production (sat på Railway)
 *   npm run user:create-admin -- --instans <id|domæne> --email <e-mail> --force                    # fx via `railway run`, hvor NODE_ENV ikke er sat
 *
 * --instans kan også være by-nøglen (slagelse, naestved, holbaek, koege, roskilde, ringsted).
 *
 * Udskriver en tilfældig midlertidig adgangskode ÉN gang til stdout (gem den i en password manager). Brugeren oprettes med
 * mustChangePassword=true (vælger selv en ny ved første login). E-mail er unik på tværs af ALLE byer: findes den allerede,
 * afvises kaldet med en dansk besked og et forslag til plus-adressering (fx navn+naestved@gmail.com).
 * Skriver en post i revisionssporet (AuditLog) uden hemmeligheder. Adgangskoden logges aldrig andre steder.
 */
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { writeAudit } from "../lib/audit";
import { cityKey, domainForKey } from "../lib/network-sites";
import { generateTempPassword, hashPassword } from "../lib/password";

export const ADMIN_ROLE = "Ansvarshavende redaktør";

export type CreateAdminArgs = { instans: string; email: string; navn?: string; force: boolean };
export type CreateAdminResult = { email: string; password: string; instansId: string; domaene: string; userId: string };

/** Forslag til plus-adresse: carsten@gmail.com + naestved -> carsten+naestved@gmail.com (mails havner i samme indbakke). */
export function suggestPlusAddress(email: string, key: string): string {
  const [local, domain] = email.split("@");
  const base = local.split("+")[0];
  return `${base}+${key}@${domain}`;
}

/** Dansk besked når e-mailen allerede findes (e-mail er unik på tværs af alle byer). Nævner aldrig hvem der ejer den. */
export function emailExistsMessage(email: string, key: string): string {
  return `E-mailen ${email} findes allerede (en e-mail kan kun bruges til én bruger på tværs af alle byer). Brug plus-adressering til en ekstra bruger, fx ${suggestPlusAddress(email, key)} — mails til den havner stadig i samme indbakke.`;
}

/** Rene argumenter (testbar): kaster med en dansk besked ved manglende/ugyldige valg. */
export function parseArgs(argv: string[]): CreateAdminArgs {
  const value = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    if (i < 0) return undefined;
    const v = argv[i + 1];
    if (!v || v.startsWith("--")) throw new Error(`${flag} mangler en værdi.`);
    return v;
  };
  const instans = value("--instans");
  const email = value("--email");
  if (!instans) throw new Error("--instans <id|domæne> mangler.");
  if (!email) throw new Error("--email <e-mail> mangler.");
  return { instans, email, navn: value("--navn"), force: argv.includes("--force") };
}

export async function createAdmin(db: PrismaClient, input: { instans: string; email: string; navn?: string }): Promise<CreateAdminResult> {
  const parsedEmail = z.string().email().safeParse(input.email.trim());
  if (!parsedEmail.success) throw new Error(`"${input.email}" er ikke en gyldig e-mail.`);
  const email = parsedEmail.data.toLowerCase();

  const target = input.instans.trim();
  const domainFromKey = domainForKey(target);
  const matches = await db.instance.findMany({
    where: { OR: [{ id: target }, { domaene: target.toLowerCase() }, ...(domainFromKey ? [{ domaene: domainFromKey }] : [])] },
    select: { id: true, navn: true, domaene: true },
  });
  if (matches.length === 0) throw new Error(`Ingen by fundet for "${target}". Brug instans-id, domæne (fx naestvedlokalt.dk) eller by-nøgle (fx naestved).`);
  if (matches.length > 1) throw new Error(`"${target}" er flertydig (${matches.length} instanser). Brug instans-id.`);
  const instance = matches[0];

  const role = await db.role.findUnique({ where: { navn: ADMIN_ROLE }, select: { id: true } });
  if (!role) throw new Error(`Rollen "${ADMIN_ROLE}" findes ikke. Kør først "npm run seed:prod" (eller "npm run roles:sync").`);

  const key = cityKey(instance.domaene);
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) throw new Error(emailExistsMessage(email, key));

  const password = generateTempPassword();
  let userId: string;
  try {
    const created = await db.user.create({
      data: {
        email,
        navn: input.navn?.trim() || `Ansvarshavende redaktør ${instance.navn.replace(/Lokalt$/i, "")}`,
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
        roleId: role.id,
        // instansId kommer fra den opslåede instans — aldrig fra en brugerleveret værdi ud over opslagsnøglen.
        instansId: instance.id,
      },
      select: { id: true },
    });
    userId = created.id;
  } catch (error) {
    // Samtidig oprettelse af samme e-mail (unik): samme besked som ovenfor, aldrig en rå databasefejl.
    if ((error as { code?: string }).code === "P2002") throw new Error(emailExistsMessage(email, key));
    throw error;
  }
  await writeAudit(db, {
    instansId: instance.id,
    actorId: null,
    actorLabel: null,
    action: "user.create_cli",
    targetId: userId,
    targetLabel: email,
    detail: { role: ADMIN_ROLE, domaene: instance.domaene },
  });
  return { email, password, instansId: instance.id, domaene: instance.domaene, userId };
}

async function main() {
  const force = process.argv.includes("--force");
  if (process.env.NODE_ENV !== "production" && !force) {
    console.error("[user:create-admin] Afvist: NODE_ENV er ikke 'production'. Brug --force, hvis du bevidst kører mod produktionsdatabasen (fx via railway run).");
    process.exit(1);
  }
  const args = parseArgs(process.argv.slice(2));
  const { db } = await import("../lib/db");
  try {
    const res = await createAdmin(db, args);
    console.log(`[user:create-admin] ${res.email} oprettet i ${res.domaene}. Midlertidig adgangskode (vises kun nu — brugeren skal vælge en ny ved første login):`);
    console.log(res.password);
  } finally {
    await db.$disconnect();
  }
}

if (path.basename(process.argv[1] ?? "") === "create-admin.ts") {
  main().catch((err) => {
    console.error(`[user:create-admin] Fejl: ${(err as Error).message}`);
    process.exit(1);
  });
}
