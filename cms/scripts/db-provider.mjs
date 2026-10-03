/**
 * Vælger Prisma-skema ud fra DATABASE_URL, så produktion virker uanset hvilke build-/startkommandoer Railway bruger
 * (railway.json er ikke altid læst): postgres:// -> prisma/postgres/schema.prisma, ellers (file:) -> prisma/schema.prisma.
 *
 *   node scripts/db-provider.mjs generate [--dry-run]   # prisma generate for det rigtige skema (postinstall)
 *   node scripts/db-provider.mjs migrate  [--dry-run]   # prisma migrate deploy kun for Postgres
 *   node scripts/db-provider.mjs prestart [--dry-run]   # (npm prestart) selvhelbred: generér klient igen hvis den er til forkert database, derefter migrate
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PG_SCHEMA = "prisma/postgres/schema.prisma";
export const SQLITE_SCHEMA = "prisma/schema.prisma";

/** true hvis URL'en er en Postgres-forbindelse. */
export function isPostgresUrl(url) {
  return /^postgres(ql)?:\/\//i.test((url ?? "").trim());
}

/** Skemafilen der hører til databasen (relativt til cms/). */
export function schemaFor(url) {
  return isPostgresUrl(url) ? PG_SCHEMA : SQLITE_SCHEMA;
}

/** Provider ('sqlite'|'postgresql'|null) som den GENEREREDE klient er bygget til (læst fra node_modules/.prisma/client/schema.prisma). */
export function clientProviderFromSchemaText(text) {
  const m = /datasource\s+\w+\s*\{[^}]*?provider\s*=\s*"([a-z]+)"/i.exec(text ?? "");
  return m ? m[1].toLowerCase() : null;
}

/** Skal klienten genereres igen? Ja, hvis den er bygget til en anden database end DATABASE_URL peger på. */
export function needsRegenerate(url, clientProvider) {
  const want = isPostgresUrl(url) ? "postgresql" : "sqlite";
  return clientProvider !== null && clientProvider !== want;
}

function run(args, dry) {
  const line = `prisma ${args.join(" ")}`;
  if (dry) {
    console.log(`[db-provider] (tørkørsel) ${line}`);
    return 0;
  }
  console.log(`[db-provider] ${line}`);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const bin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
  const res = spawnSync(bin, args, { cwd: root, stdio: "inherit", env: process.env });
  return res.status ?? 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  const dry = rest.includes("--dry-run");
  const url = process.env.DATABASE_URL;
  if (cmd === "generate") {
    process.exit(run(["generate", "--schema", schemaFor(url)], dry));
  } else if (cmd === "migrate") {
    if (!isPostgresUrl(url)) {
      console.log("[db-provider] DATABASE_URL er ikke Postgres — ingen migrationer køres.");
      process.exit(0);
    }
    process.exit(run(["migrate", "deploy", "--schema", PG_SCHEMA], dry));
  } else if (cmd === "prestart") {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    let provider = null;
    try {
      provider = clientProviderFromSchemaText(readFileSync(path.join(root, "node_modules", ".prisma", "client", "schema.prisma"), "utf8"));
    } catch {
      /* klienten findes ikke endnu — generér nedenfor */
    }
    if (provider === null || needsRegenerate(url, provider)) {
      console.log(`[db-provider] Prisma-klienten er bygget til '${provider ?? "ukendt"}', men DATABASE_URL kræver '${isPostgresUrl(url) ? "postgresql" : "sqlite"}' — genererer igen.`);
      const code = run(["generate", "--schema", schemaFor(url)], dry);
      if (code !== 0) process.exit(code);
    }
    if (!isPostgresUrl(url)) {
      console.log("[db-provider] DATABASE_URL er ikke Postgres — ingen migrationer køres.");
      process.exit(0);
    }
    process.exit(run(["migrate", "deploy", "--schema", PG_SCHEMA], dry));
  } else {
    console.error("Brug: node scripts/db-provider.mjs generate|migrate|prestart [--dry-run]");
    process.exit(2);
  }
}
