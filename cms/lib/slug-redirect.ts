/**
 * Slug-/sektionsskift på publicerede artikler -> permanent omdirigering fra den gamle URL.
 *
 * Design: en redirect-række peger på ARTIKEL-ID (ikke på den nye slug). Opslaget beregner altid artiklens NUVÆRENDE sti,
 * så en artikel der omdøbes A -> B -> C giver A -> C og B -> C (aldrig kæder), og tilbageskift C -> A rydder A-rækken.
 * Alt er tenant-afgrænset på `instansId`.
 */
import { db } from "@/lib/db";
import { slugCandidates, articlePath } from "@/lib/seo/url";

type Client = Pick<typeof db, "slugRedirect">;

type CategoryLike = { slug: string; parent?: { slug: string } | null } | null | undefined;

/** Sektionsslug som den offentlige URL bruger: forældrekategori hvis den findes, ellers kategorien selv, ellers "nyheder". */
export function sectionSlugOf(kategori: CategoryLike): string {
  return kategori?.parent?.slug ?? kategori?.slug ?? "nyheder";
}

export function publicPath(kategori: CategoryLike, slug: string): string {
  return articlePath(sectionSlugOf(kategori), slug);
}

/**
 * Registrér at en (tidligere) publiceret artikel har skiftet URL. Kaldes i samme transaktion som artikel-opdateringen.
 * Returnerer true hvis der blev oprettet/opdateret en omdirigering.
 */
export async function recordSlugRedirect(
  client: Client,
  args: { instansId: string; articleId: string; from: { sektion: string; slug: string }; to: { sektion: string; slug: string } },
): Promise<boolean> {
  const { instansId, articleId, from, to } = args;
  // Den nye URL må aldrig selv være et redirect-mål (ellers kunne den "spise" artiklen): ryd rækker på den nye sti.
  await client.slugRedirect.deleteMany({ where: { instansId, fraSektion: to.sektion, fraSlug: to.slug } });
  if (from.sektion === to.sektion && from.slug === to.slug) return false;
  await client.slugRedirect.upsert({
    where: { instansId_fraSektion_fraSlug: { instansId, fraSektion: from.sektion, fraSlug: from.slug } },
    update: { tilArticleId: articleId },
    create: { instansId, fraSektion: from.sektion, fraSlug: from.slug, tilArticleId: articleId },
  });
  return true;
}

/**
 * Slår en forespurgt URL (sektion + slug) op i omdirigeringstabellen. Returnerer den NUVÆRENDE sti, eller null hvis der
 * ikke er noget (offentligt) mål — eller målet er den forespurgte sti selv (ingen løkke).
 */
export async function findArticleRedirect(instansId: string, sectionSlug: string, slugParam: string): Promise<string | null> {
  const row = await db.slugRedirect.findFirst({
    where: { instansId, fraSektion: sectionSlug, fraSlug: { in: slugCandidates(slugParam) } },
    include: { article: { include: { kategori: { include: { parent: true } } } } },
  });
  if (!row) return null;
  const article = row.article;
  if (!article || article.instansId !== instansId || article.status !== "Publiceret") return null;
  const target = publicPath(article.kategori, article.slug);
  const requested = articlePath(sectionSlug, row.fraSlug);
  if (target === requested) return null;
  return target;
}
