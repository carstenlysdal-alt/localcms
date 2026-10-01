/**
 * Produktions-seed (idempotent). Opretter KUN det, en tom produktionsdatabase behøver for at kunne logge ind:
 *   1. de 6 by-instanser (Slagelse, Næstved, Holbæk, Køge, Roskilde, Ringsted) — eksisterende instanser røres ikke
 *   2. standardroller (lib/default-roles.ts) — nye roller oprettes, eksisterende får kun rettigheder lagt til
 *   3. ÉN første administrator fra ADMIN_EMAIL med en tilfældig adgangskode, der printes ÉN gang til stdout
 *      (kun når brugeren oprettes; findes brugeren, ændres intet og intet printes)
 * Ingen demo-data og aldrig en kendt adgangskode.
 *
 *   npm run seed:prod                    # kræver NODE_ENV=production (sættes på Railway-servicen)
 *   npm run seed:prod -- --force         # kør fra fx `railway run` hvor NODE_ENV ikke er sat
 *
 * Env: DATABASE_URL (postgresql://…), ADMIN_EMAIL (påkrævet), ADMIN_NAME (valgfri), ADMIN_INSTANCE_DOMAIN (default slagelselokalt.dk)
 */
import { randomBytes } from "node:crypto";
import path from "node:path";
import { hash } from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { DEFAULT_ROLES } from "../lib/default-roles";
import { ALL_NETWORK_SITES } from "../lib/network-sites";
import { NETWORK_SITES } from "../prisma/network-seed-data";

const TOP_CATEGORIES = ["Nyheder", "Erhverv", "Sport", "Kultur", "Foreningsliv", "Debat"];
const ADMIN_ROLE = "Ansvarshavende redaktør";

const SLAGELSE = {
  id: "slagelse-reference",
  colors: { accent: "#9E3D1B", accentStrong: "#7F2F13", accentSoft: "#F6E3D8", onAccent: "#FFFFFF" },
  areas: ["Slagelse By", "Korsør", "Skælskør", "Dalmose", "Vemmelev", "Boeslunde", "Agersø", "Omø"],
  sideTekster: {
    omMediet: "SlagelseLokalt er et lokalt nyhedsmedie med fuld journalistisk uafhængighed.",
    principper: "Vi følger god presseskik og mærker alt betalt og assisteret indhold tydeligt.",
    kontakt: "Kontakt redaktionen på redaktion@slagelselokalt.dk.",
  },
};

export type InstanceSeed = {
  id: string;
  navn: string;
  domaene: string;
  farver: Record<string, string>;
  geografiskDækning: string[];
  sideTekster: Record<string, string>;
};

/** De 6 by-instanser, afledt af lib/network-sites.ts (navne/domæner) + prisma/network-seed-data.ts (farver, delområder, tekster). */
export function instanceSeeds(): InstanceSeed[] {
  return ALL_NETWORK_SITES.map((site) => {
    if (site.domaene === "slagelselokalt.dk") {
      return { id: SLAGELSE.id, navn: site.navn, domaene: site.domaene, farver: SLAGELSE.colors, geografiskDækning: SLAGELSE.areas, sideTekster: SLAGELSE.sideTekster };
    }
    const cfg = NETWORK_SITES.find((c) => c.domaene === site.domaene);
    if (!cfg) throw new Error(`Ingen netværkskonfiguration for ${site.domaene}.`);
    return { id: cfg.id, navn: site.navn, domaene: site.domaene, farver: cfg.colors, geografiskDækning: cfg.areas.map((a) => a.navn), sideTekster: cfg.sideTekster };
  });
}

export type SeedResult = {
  instances: { created: string[]; existing: string[] };
  roles: { created: string[]; updated: string[] };
  admin: { email: string; created: boolean; password?: string; instance: string };
};

export async function seedProduction(
  db: PrismaClient,
  opts: { adminEmail: string; adminName?: string; adminInstanceDomain?: string },
): Promise<SeedResult> {
  const email = z.string().email().parse(opts.adminEmail).toLowerCase().trim();
  const seeds = instanceSeeds();
  const result: SeedResult = {
    instances: { created: [], existing: [] },
    roles: { created: [], updated: [] },
    admin: { email, created: false, instance: opts.adminInstanceDomain ?? "slagelselokalt.dk" },
  };

  const adminSeed = seeds.find((s) => s.domaene === result.admin.instance);
  if (!adminSeed) throw new Error(`ADMIN_INSTANCE_DOMAIN '${result.admin.instance}' er ikke en af de 6 byer.`);

  const network = ALL_NETWORK_SITES.map(({ navn, domaene, by }) => ({ navn, domaene, by }));
  for (const seed of seeds) {
    const found = await db.instance.findFirst({ where: { OR: [{ domaene: seed.domaene }, { id: seed.id }] }, select: { id: true } });
    if (found) {
      result.instances.existing.push(seed.domaene);
      continue;
    }
    await db.instance.create({
      data: {
        id: seed.id,
        navn: seed.navn,
        domaene: seed.domaene,
        farver: seed.farver,
        typografi: { heading: "Bricolage Grotesque", body: "Literata" },
        geografiskDækning: seed.geografiskDækning,
        kategoriTaksonomi: TOP_CATEGORIES,
        kvoteloftProcent: 25,
        markingTekster: { sponsorLabel: "Sponsoreret indhold", partnerLabel: "Finansieret af", principperUrl: "/om-mediet/redaktionelle-principper" },
        sideTekster: seed.sideTekster,
        netvaerk: network.filter((n) => n.domaene !== seed.domaene),
      },
    });
    result.instances.created.push(seed.domaene);
  }

  const roleIds = new Map<string, string>();
  for (const def of DEFAULT_ROLES) {
    const existing = await db.role.findUnique({ where: { navn: def.navn } });
    if (!existing) {
      const created = await db.role.create({ data: { navn: def.navn, permissions: [...def.permissions] } });
      roleIds.set(def.navn, created.id);
      result.roles.created.push(def.navn);
      continue;
    }
    roleIds.set(def.navn, existing.id);
    const current = Array.isArray(existing.permissions) ? (existing.permissions as string[]) : [];
    const merged = Array.from(new Set([...current, ...def.permissions]));
    if (merged.length !== current.length) {
      await db.role.update({ where: { id: existing.id }, data: { permissions: merged } });
      result.roles.updated.push(def.navn);
    }
  }

  const existingAdmin = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (!existingAdmin) {
    const instance = await db.instance.findFirstOrThrow({ where: { domaene: adminSeed.domaene }, select: { id: true } });
    const password = randomBytes(18).toString("base64url");
    await db.user.create({
      data: {
        email,
        navn: opts.adminName?.trim() || "Administrator",
        passwordHash: await hash(password, 12),
        roleId: roleIds.get(ADMIN_ROLE)!,
        instansId: instance.id,
      },
    });
    result.admin.created = true;
    result.admin.password = password;
  }
  return result;
}

async function main() {
  const force = process.argv.includes("--force");
  if (process.env.NODE_ENV !== "production" && !force) {
    console.error("[seed:prod] Afvist: NODE_ENV er ikke 'production'. Brug --force, hvis du bevidst kører mod produktionsdatabasen (fx via railway run).");
    process.exit(1);
  }
  if (!/^postgres(ql)?:\/\//i.test(process.env.DATABASE_URL ?? "")) {
    console.error("[seed:prod] Afvist: DATABASE_URL skal være en postgresql://-URL. (Lokal SQLite seedes med `npm run seed`.)");
    process.exit(1);
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.error("[seed:prod] ADMIN_EMAIL mangler.");
    process.exit(1);
  }
  const { db } = await import("../lib/db");
  try {
    const res = await seedProduction(db, { adminEmail, adminName: process.env.ADMIN_NAME, adminInstanceDomain: process.env.ADMIN_INSTANCE_DOMAIN || undefined });
    console.log(`[seed:prod] instanser: ${res.instances.created.length} oprettet, ${res.instances.existing.length} fandtes`);
    console.log(`[seed:prod] roller: ${res.roles.created.length} oprettet, ${res.roles.updated.length} opdateret`);
    if (res.admin.created) {
      console.log(`[seed:prod] administrator oprettet: ${res.admin.email} (${res.admin.instance})`);
      console.log("[seed:prod] ENGANGS-ADGANGSKODE (vises kun nu — gem den i en password manager og skift den ved første login):");
      console.log(res.admin.password);
    } else {
      console.log(`[seed:prod] administrator ${res.admin.email} findes allerede — uændret, ingen adgangskode udskrevet.`);
    }
  } finally {
    await db.$disconnect();
  }
}

if (path.basename(process.argv[1] ?? "") === "seed-prod.ts") {
  main().catch((err) => {
    console.error(`[seed:prod] Fejl: ${(err as Error).message}`);
    process.exit(1);
  });
}
