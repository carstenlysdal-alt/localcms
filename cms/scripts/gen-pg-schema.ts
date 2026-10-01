/**
 * Udleder prisma/postgres/schema.prisma fra prisma/schema.prisma (single source of truth = SQLite-skemaet,
 * som dev-miljøet og de andre agenter bruger). Kun datasource-blokken og filhovedet erstattes; alle modeller,
 * indekser og relationer overtages uændret.
 *
 * Skemaet er bevidst cross-provider (enums som String, lister som Json), så der er ingen sqlite-specifikke
 * attributter at oversætte: PostgreSQL mapper `String` -> text (ingen længdegrænse, derfor intet behov for
 * @db.Text), `Json` -> jsonb, `DateTime` -> timestamp(3), `Float` -> double precision. Hvis der engang
 * indføres en provider-specifik attribut i kilden, tilføjes oversættelsen i `toPostgresSchema()`.
 *
 *   npm run prisma:pg:schema          # skriv prisma/postgres/schema.prisma
 *   npm run prisma:pg:check           # fejl (exit 1) hvis filen ikke er i sync med kilden
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

export const SOURCE_SCHEMA = path.resolve(__dirname, "../prisma/schema.prisma");
export const PG_SCHEMA = path.resolve(__dirname, "../prisma/postgres/schema.prisma");

const BANNER = `// GENERERET FIL — redigér ikke i hånden.
// Kilde: prisma/schema.prisma (SQLite, dev). Regenerér med:  npm run prisma:pg:schema
// Bruges af Railway/produktion: prisma generate/migrate deploy --schema prisma/postgres/schema.prisma
// Nye migrationer:  npm run prisma:pg:migration -- <navn>

`;

const PG_DATASOURCE = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}`;

const DATASOURCE_RE = /datasource\s+db\s*\{[^}]*\}/;

/** Ren funktion: SQLite-skema (tekst) -> PostgreSQL-skema (tekst). Deterministisk. */
export function toPostgresSchema(source: string): string {
  const text = source.replace(/\r\n/g, "\n");
  const ds = DATASOURCE_RE.exec(text);
  if (!ds) throw new Error("Kilde-skemaet har ingen datasource db { … }-blok.");
  if (!/provider\s*=\s*"sqlite"/.test(ds[0])) {
    throw new Error('Kilde-skemaet (prisma/schema.prisma) skal have provider = "sqlite"; PostgreSQL-skemaet er afledt af det.');
  }
  const generator = text.search(/^generator\s+\w+\s*\{/m);
  if (generator < 0) throw new Error("Kilde-skemaet har ingen generator-blok.");
  // Alt før første generator-blok er kilde-kommentarer om SQLite og erstattes af banneret.
  const body = text.slice(generator).replace(DATASOURCE_RE, PG_DATASOURCE);
  return BANNER + body.replace(/\s+$/, "") + "\n";
}

export function readGenerated(): string {
  return toPostgresSchema(readFileSync(SOURCE_SCHEMA, "utf8"));
}

/** Er prisma/postgres/schema.prisma i sync med kilden? */
export function checkInSync(): { ok: boolean; reason?: string } {
  if (!existsSync(PG_SCHEMA)) return { ok: false, reason: "prisma/postgres/schema.prisma mangler." };
  const onDisk = readFileSync(PG_SCHEMA, "utf8").replace(/\r\n/g, "\n");
  if (onDisk !== readGenerated()) {
    return { ok: false, reason: "prisma/postgres/schema.prisma er ude af sync med prisma/schema.prisma — kør: npm run prisma:pg:schema" };
  }
  return { ok: true };
}

export function writeGenerated(): void {
  mkdirSync(path.dirname(PG_SCHEMA), { recursive: true });
  writeFileSync(PG_SCHEMA, readGenerated());
}

function main() {
  if (process.argv.includes("--check")) {
    const res = checkInSync();
    if (!res.ok) {
      console.error(`[pg-schema] ${res.reason}`);
      process.exit(1);
    }
    console.log("[pg-schema] prisma/postgres/schema.prisma er i sync.");
    return;
  }
  writeGenerated();
  console.log("[pg-schema] skrev prisma/postgres/schema.prisma");
}

if (path.basename(process.argv[1] ?? "") === "gen-pg-schema.ts") main();
