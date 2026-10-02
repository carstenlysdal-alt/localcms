import { can, canEditArticle, PERMISSIONS, type PermissionUser } from "@/lib/permissions";

/** Adgang til /redaktion/artikler/[id]/preview (rent, testbart): kun egen instans og kun hvis brugeren må redigere artiklen. */
export type PreviewUser = (PermissionUser & { instansId?: string }) | null | undefined;
export type ArticlePreviewDecision = { allow: true } | { allow: false; reason: "login" | "forbidden" | "missing" };

export function articlePreviewDecision(user: PreviewUser, article: { forfatterId: string | null; instansId: string } | null | undefined): ArticlePreviewDecision {
  if (!user) return { allow: false, reason: "login" };
  if (!can(user, PERMISSIONS.ARTICLE_CREATE)) return { allow: false, reason: "forbidden" };
  if (!article || article.instansId !== user.instansId) return { allow: false, reason: "missing" };
  if (!canEditArticle(user, article)) return { allow: false, reason: "forbidden" };
  return { allow: true };
}

export const ID_PATTERN = /^[A-Za-z0-9_-]{8,40}$/;
