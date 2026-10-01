/**
 * Opret en API-nøgle til agent-indtaget (vises KUN én gang).
 *   npm run ingest:key -- --domain naestvedlokalt.dk --name "aI-library / Graver" [--scopes signals:write,articles:draft,health:read] [--expires-days 365]
 */
import { PrismaClient } from "@prisma/client";
import { createApiKey } from "../lib/ingest/auth";
import { INGEST_SCOPES, type IngestScope } from "../lib/ingest/schema";

try { process.loadEnvFile?.(".env"); } catch { /* valgfri */ }

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const domain = arg("domain");
  const name = arg("name");
  if (!domain || !name) {
    console.error('Brug: npm run ingest:key -- --domain <instans-domæne> --name "<navn>" [--scopes a,b] [--expires-days N]');
    process.exit(1);
  }
  const scopes = (arg("scopes") ?? "signals:write,articles:draft,health:read").split(",").map((s) => s.trim()) as IngestScope[];
  const bad = scopes.filter((s) => !(INGEST_SCOPES as readonly string[]).includes(s));
  if (bad.length) throw new Error(`Ukendte scopes: ${bad.join(", ")}`);
  const days = Number(arg("expires-days") ?? 0);

  const db = new PrismaClient();
  const instance = await db.instance.findFirst({ where: { domaene: domain } });
  if (!instance) throw new Error(`Ingen instans med domæne '${domain}'.`);
  await db.$disconnect();

  const created = await createApiKey({ instansId: instance.id, name, scopes, expiresAt: days > 0 ? new Date(Date.now() + days * 86_400_000) : null });
  console.log(`\nAPI-nøgle oprettet for ${instance.navn} (${instance.domaene})`);
  console.log(`  id:      ${created.id}`);
  console.log(`  prefix:  ${created.prefix}`);
  console.log(`  scopes:  ${scopes.join(", ")}`);
  console.log(`\n  NØGLE (vises kun nu — gem den i aI-librarys secret store):\n  ${created.key}\n`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
