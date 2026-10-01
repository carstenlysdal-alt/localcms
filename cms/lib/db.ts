import { PrismaClient } from "@prisma/client";

/**
 * Én Prisma-klient for begge miljøer. Hvilken provider klienten er genereret til afgøres af build-trinnet:
 *   - dev/test:  `prisma generate` (prisma/schema.prisma, SQLite) — kører i postinstall
 *   - Railway:   `npm run build:railway` genererer klienten fra prisma/postgres/schema.prisma
 * Der er kun ét klientpakke (@prisma/client) og ét genereret output pr. miljø.
 *
 * PostgreSQL: forbindelsespuljen sættes med connection_limit/pool_timeout, hvis URL'en ikke selv angiver dem
 * (Prismas standard er antal CPU'er * 2 + 1, hvilket på en stor Railway-vært hurtigt æder Postgres' max_connections).
 * Overstyr med DATABASE_POOL_SIZE (fx 5) eller ved at lægge ?connection_limit=… på DATABASE_URL.
 */
export function resolveDatasourceUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env.DATABASE_URL;
  if (!raw || !/^postgres(ql)?:\/\//i.test(raw)) return undefined; // SQLite: brug skemaets env("DATABASE_URL") uændret
  try {
    const url = new URL(raw);
    const size = Number(env.DATABASE_POOL_SIZE);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", String(Number.isInteger(size) && size > 0 && size <= 100 ? size : 10));
    }
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "10");
    return url.toString();
  } catch {
    return undefined;
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: resolveDatasourceUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
