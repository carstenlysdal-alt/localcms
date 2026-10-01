/**
 * Tilføjer nye standardrettigheder til EKSISTERENDE roller (additivt — fjerner aldrig noget).
 * Kør efter deploy af ny rettighed:  npm run roles:sync
 * Brugere skal logge ud/ind før JWT'en afspejler ændringen — server-actions bruger dog
 * getAuthorizedUser(), som slår rettigheder op i databasen ved hvert kald.
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLES } from "../lib/default-roles";

try { process.loadEnvFile?.(".env"); } catch { /* valgfri */ }
const db = new PrismaClient();

async function main() {
  for (const def of DEFAULT_ROLES) {
    const role = await db.role.findUnique({ where: { navn: def.navn } });
    if (!role) continue;
    const current = Array.isArray(role.permissions) ? (role.permissions as string[]) : [];
    const merged = Array.from(new Set([...current, ...def.permissions]));
    if (merged.length !== current.length) {
      await db.role.update({ where: { id: role.id }, data: { permissions: merged } });
      console.log(`${def.navn}: +${merged.length - current.length} rettigheder`);
    }
  }
}

main().finally(() => db.$disconnect());
