/**
 * Ens case-ufølsom "indeholder"-søgning på SQLite (dev/test) og PostgreSQL (produktion) — T5 P2-6.
 *
 * Prisma-klienten er genereret til ÉN provider. På PostgreSQL er `contains` case-SENSITIV, medmindre `mode: "insensitive"`
 * angives (ILIKE, korrekt for æ/ø/å). `mode` findes ikke på SQLite-klienten (ukendt argument -> fejl), hvor `LIKE` til
 * gengæld kun er case-ufølsom for ASCII. Derfor:
 *   - PostgreSQL (DATABASE_URL = postgres…): `{ contains, mode: "insensitive" }`
 *   - SQLite: samme felt matches mod varianter af søgeordet (som tastet, små, store og stort begyndelsesbogstav), så
 *     "ørsted" også finder "Ørsted".
 * Brug `searchOr(["titel","manchet"], q)` som `OR`-liste i et Prisma where.
 */

export type ContainsFilter = { contains: string; mode?: "insensitive" };

export function isPostgresUrl(url: string | undefined = process.env.DATABASE_URL): boolean {
  return /^postgres(ql)?:\/\//i.test(url ?? "");
}

/** Varianter af et søgeord til SQLite's ASCII-only LIKE (æøå-sikker for den almindelige "Stort begyndelsesbogstav"). */
export function caseVariants(term: string): string[] {
  const t = term.trim();
  if (!t) return [];
  return Array.from(new Set([t, t.toLowerCase(), t.toUpperCase(), t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(), t.charAt(0).toUpperCase() + t.slice(1)]));
}

/** `OR`-liste der matcher `term` (case-ufølsomt) i et af felterne. Tom liste hvis søgeordet er tomt. */
export function searchOr<W = Record<string, ContainsFilter>>(fields: readonly string[], term: string, postgres: boolean = isPostgresUrl()): W[] {
  const t = term.trim();
  if (!t) return [];
  if (postgres) return fields.map((f) => ({ [f]: { contains: t, mode: "insensitive" } }) as unknown as W);
  return fields.flatMap((f) => caseVariants(t).map((v) => ({ [f]: { contains: v } }) as unknown as W));
}

/** Som searchOr for ét felt, som et enkelt filter-objekt (til `{ titel: ... }`). */
export function containsInsensitive(term: string, postgres: boolean = isPostgresUrl()): ContainsFilter {
  return postgres ? { contains: term.trim(), mode: "insensitive" } : { contains: term.trim() };
}
