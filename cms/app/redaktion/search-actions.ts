"use server";

import type { Prisma } from "@prisma/client";
import { getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchOr } from "@/lib/search";

export type QuickArticleHit = { id: string; titel: string; status: string };

/** Hurtigsøgning i topbaren: artikeltitler i brugerens egen instans (højst 6). Kræver kun login, som artikellisten. */
export async function quickSearchArticles(query: string): Promise<QuickArticleHit[]> {
  const user = await getAuthorizedUser();
  if (!user) return [];
  const q = String(query ?? "").trim().slice(0, 80);
  if (q.length < 2) return [];
  const rows = await db.article.findMany({
    where: { instansId: user.instansId, OR: searchOr<Prisma.ArticleWhereInput>(["titel"], q) },
    select: { id: true, titel: true, status: true },
    orderBy: { opdateretTid: "desc" },
    take: 6,
  });
  return rows;
}
