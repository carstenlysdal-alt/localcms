import { db } from "./db";
import type { CategoryNode } from "./marking";

/**
 * Henter en kategori med HELE forældrekæden (id-baseret, begrænset til 10 niveauer og cyklus-sikret),
 * altid afgrænset til instansen. Bruges til AI-spærringen, så et barn af Krimi/Sundhed ikke kan undslippe
 * ved omdøbning af barnet, og så reglen ikke afhænger af kun ét navn/slug.
 */
export async function loadCategoryTree(instansId: string, categoryId: string | null | undefined): Promise<CategoryNode | null> {
  if (!categoryId) return null;
  const root: CategoryNode & { parentId?: string | null } = { slug: null, navn: null, parent: null };
  let cursor: CategoryNode = root;
  let id: string | null = categoryId;
  const seen = new Set<string>();
  for (let depth = 0; id && depth < 10 && !seen.has(id); depth++) {
    seen.add(id);
    const row: { slug: string; navn: string; parentId: string | null } | null = await db.category.findFirst({ where: { id, instansId }, select: { slug: true, navn: true, parentId: true } });
    if (!row) return depth === 0 ? null : root;
    cursor.slug = row.slug;
    cursor.navn = row.navn;
    id = row.parentId;
    if (id) {
      const next: CategoryNode = { slug: null, navn: null, parent: null };
      cursor.parent = next;
      cursor = next;
    }
  }
  return root;
}
