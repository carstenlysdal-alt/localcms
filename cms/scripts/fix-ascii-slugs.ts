/**
 * Idempotent: oversætter ikke-ASCII slugs (æ/ø/å) til ASCII i eksisterende rækker
 * (Article, Author, GeoTag, Tag, Category). Ældre URL'er 301-omdirigeres af proxy.ts.
 * Kør:  npx tsx scripts/fix-ascii-slugs.ts          (tør-kørsel: --dry)
 */
import { PrismaClient } from "@prisma/client";
import { isAsciiSlug, slugify, transliterateDa } from "../lib/slug";

const db = new PrismaClient();
const dry = process.argv.includes("--dry");

function fixed(slug: string | null): string | null {
  if (!slug || isAsciiSlug(slug)) return null;
  const next = slugify(transliterateDa(slug), 120);
  return next && next !== slug ? next : null;
}

async function main() {
  let changed = 0;
  const report = (kind: string, from: string, to: string) => {
    changed++;
    console.log(`${dry ? "[dry] " : ""}${kind}: ${from} -> ${to}`);
  };

  for (const a of await db.article.findMany({ select: { id: true, slug: true } })) {
    const next = fixed(a.slug);
    if (!next) continue;
    const clash = await db.article.findUnique({ where: { slug: next } });
    const finalSlug = clash && clash.id !== a.id ? `${next}-${a.id.slice(-4)}` : next;
    report("Article", a.slug, finalSlug);
    if (!dry) await db.article.update({ where: { id: a.id }, data: { slug: finalSlug } });
  }
  for (const m of [
    ["Author", db.author],
    ["GeoTag", db.geoTag],
    ["Tag", db.tag],
    ["Category", db.category],
  ] as const) {
    const rows = (await (m[1] as unknown as { findMany: (a: object) => Promise<Array<{ id: string; slug: string | null }>> }).findMany({ select: { id: true, slug: true } }));
    for (const r of rows) {
      const next = fixed(r.slug);
      if (!next) continue;
      report(m[0], r.slug ?? "", next);
      if (!dry) await (m[1] as unknown as { update: (a: object) => Promise<unknown> }).update({ where: { id: r.id }, data: { slug: next } });
    }
  }
  console.log(changed ? `Rettede ${changed} slug(s).` : "Ingen ikke-ASCII slugs fundet.");
}

main().finally(() => db.$disconnect());
