/**
 * Giver (eller fjerner) en brugers adgang til andre byer — ét login til flere byer ("netværksadgang").
 *
 *   npm run user:grant-access -- --email <e-mail> --alle-instanser              # alle byer (kræver NODE_ENV=production)
 *   npm run user:grant-access -- --email <e-mail> --instans <id|domæne|by-nøgle>
 *   npm run user:grant-access -- --email <e-mail> --alle-instanser --revoke      # fjerner ekstra adgang igen (hjemmebyen beholdes)
 *   ... --force                                                                  # fx via `railway run`, hvor NODE_ENV ikke er sat
 *
 * Hjemmebyen (brugerens egen instans) er altid tilladt og kan hverken gives eller fjernes. Brugerens ene globale rolle gælder i
 * alle byer, hun har adgang til. Idempotent (kan køres igen uden effekt) og med revisionspost (AuditLog) pr. ændring, uden hemmeligheder.
 * Intet udskrives om adgangskoder. Fjernes adgangen, falder brugerens aktive by tilbage til hjemmebyen ved næste forespørgsel.
 */
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { applyAccessChange, findInstanceByRef } from "../lib/instance-access";

export type GrantAccessArgs = { email: string; alle: boolean; instans?: string; revoke: boolean; force: boolean };
export type GrantAccessResult = { email: string; home: string; added: string[]; removed: string[]; unchanged: string[] };

/** Rene argumenter (testbar): kaster med en dansk besked ved manglende/ugyldige valg. */
export function parseArgs(argv: string[]): GrantAccessArgs {
  const value = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    if (i < 0) return undefined;
    const v = argv[i + 1];
    if (!v || v.startsWith("--")) throw new Error(`${flag} mangler en værdi.`);
    return v;
  };
  const email = value("--email");
  if (!email) throw new Error("--email <e-mail> mangler.");
  const alle = argv.includes("--alle-instanser");
  const instans = value("--instans");
  if (alle && instans) throw new Error("Brug enten --alle-instanser eller --instans, ikke begge.");
  if (!alle && !instans) throw new Error("Angiv --alle-instanser eller --instans <id|domæne|by-nøgle>.");
  return { email, alle, instans, revoke: argv.includes("--revoke"), force: argv.includes("--force") };
}

export async function grantAccess(db: PrismaClient, input: { email: string; alle: boolean; instans?: string; revoke: boolean }): Promise<GrantAccessResult> {
  const parsedEmail = z.string().email().safeParse(input.email.trim());
  if (!parsedEmail.success) throw new Error(`"${input.email}" er ikke en gyldig e-mail.`);
  const user = await db.user.findUnique({ where: { email: parsedEmail.data.toLowerCase() }, select: { id: true, email: true, instansId: true, deaktiveretTid: true, instans: { select: { navn: true } } } });
  if (!user) throw new Error(`Ingen bruger med e-mailen ${parsedEmail.data}.`);
  if (user.deaktiveretTid && !input.revoke) throw new Error("Brugeren er deaktiveret. Aktivér brugeren, før der gives adgang.");

  let targetIds: string[];
  if (input.alle) {
    targetIds = (await db.instance.findMany({ select: { id: true } })).map((i) => i.id);
  } else {
    const instance = await findInstanceByRef(db, input.instans ?? "");
    if (!instance) throw new Error(`Ingen entydig by fundet for "${input.instans}". Brug instans-id, domæne (fx naestvedlokalt.dk) eller by-nøgle (fx naestved).`);
    if (instance.id === user.instansId && input.revoke) throw new Error("Hjemmebyen kan ikke fjernes — en bruger beholder altid adgang til sin egen by.");
    targetIds = [instance.id];
  }
  const nonHome = targetIds.filter((id) => id !== user.instansId);
  const current = new Set((await db.userInstanceAccess.findMany({ where: { userId: user.id }, select: { instansId: true } })).map((r) => r.instansId));
  const add = input.revoke ? [] : nonHome.filter((id) => !current.has(id));
  const remove = input.revoke ? nonHome.filter((id) => current.has(id)) : [];

  const names = new Map((await db.instance.findMany({ select: { id: true, domaene: true } })).map((i) => [i.id, i.domaene]));
  const { added, removed } = await db.$transaction((tx) =>
    applyAccessChange(tx, { target: { id: user.id, email: user.email }, add, remove, actor: { id: null, label: null }, source: "cli" }),
  );
  const label = (ids: string[]) => ids.map((id) => names.get(id) ?? id).sort();
  const changed = new Set([...added, ...removed]);
  return {
    email: user.email,
    home: names.get(user.instansId) ?? user.instansId,
    added: label(added),
    removed: label(removed),
    unchanged: label(nonHome.filter((id) => !changed.has(id))),
  };
}

async function main() {
  const force = process.argv.includes("--force");
  if (process.env.NODE_ENV !== "production" && !force) {
    console.error("[user:grant-access] Afvist: NODE_ENV er ikke 'production'. Brug --force, hvis du bevidst kører mod produktionsdatabasen (fx via railway run).");
    process.exit(1);
  }
  const args = parseArgs(process.argv.slice(2));
  const { db } = await import("../lib/db");
  try {
    const res = await grantAccess(db, args);
    console.log(`[user:grant-access] ${res.email} (hjemmeby: ${res.home})`);
    if (res.added.length) console.log(`  + adgang givet: ${res.added.join(", ")}`);
    if (res.removed.length) console.log(`  - adgang fjernet: ${res.removed.join(", ")}`);
    if (res.unchanged.length) console.log(`  = uændret: ${res.unchanged.join(", ")}`);
    if (!res.added.length && !res.removed.length) console.log("  Ingen ændringer (allerede som ønsket).");
    console.log("  Brugeren skal ikke logge ind igen: byskifteren vises ved næste sideindlæsning.");
  } finally {
    await db.$disconnect();
  }
}

if (path.basename(process.argv[1] ?? "") === "grant-access.ts") {
  main().catch((err) => {
    console.error(`[user:grant-access] Fejl: ${(err as Error).message}`);
    process.exit(1);
  });
}
