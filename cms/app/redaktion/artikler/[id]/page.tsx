import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ArticleForm } from "@/components/editor/article-form";
import { ArticleCorrections } from "@/components/editor/article-corrections";
import { AiDock } from "@/components/editor/ai-dock";
import { auth } from "@/lib/auth";
import { parseBlocks } from "@/lib/blocks/schema";
import { db } from "@/lib/db";
import { can, canEditArticle, PERMISSIONS } from "@/lib/permissions";
import { availableTransitions } from "@/lib/workflow";
import type { Marking } from "@/lib/marking";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const { id } = await params;

  const [article, categories, authors, tags, geoTags, media, corrections] = await Promise.all([
    db.article.findFirst({
      where: { id, instansId: session.user.instansId },
      include: { tags: true, geoTags: true },
    }),
    db.category.findMany({
      where: { instansId: session.user.instansId },
      include: { parent: true },
      orderBy: [{ parentId: "asc" }, { sortering: "asc" }, { navn: "asc" }],
    }),
    db.author.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" } }),
    db.tag.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" } }),
    db.geoTag.findMany({ where: { instansId: session.user.instansId }, orderBy: { navn: "asc" } }),
    db.media.findMany({
      where: { instansId: session.user.instansId, filtype: "billede" },
      orderBy: { createdAt: "desc" },
      select: { id: true, url: true, altTekst: true, billedtekst: true, filnavn: true },
    }),
    db.correction.findMany({
      where: { articleId: id, instansId: session.user.instansId, fjernetTid: null },
      orderBy: { dato: "desc" },
    }),
  ]);

  if (!article) notFound();
  if (!canEditArticle(session.user, article)) {
    return (
      <main className="admin-main">
        <div className="dialog inline-dialog">
          <h1 className="dialog-title">Ingen redigeringsadgang</h1>
          <p className="dialog-body">Du kan kun redigere dine egne artikler.</p>
          <Link className="btn btn-secondary" href="/redaktion/artikler">
            Til oversigten
          </Link>
        </div>
      </main>
    );
  }

  const formattedCategories = categories
    .map((c) => ({
      id: c.id,
      navn: c.parent ? `${c.parent.navn} → ${c.navn}` : c.navn,
    }))
    .sort((a, b) => a.navn.localeCompare(b.navn, "da"));

  const marking = (article.marking as unknown as Marking) || null;
  const chatSessionId = `artikel-${article.id}`;
  const chatHistory = await db.chatMessage.findMany({
    where: { sessionId: chatSessionId, instansId: session.user.instansId },
    orderBy: { createdAt: "asc" },
    take: 40,
  });

  return (
    <AiDock
      sessionId={chatSessionId}
      initialMessages={chatHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))}
    >
      <main className="editor-page">
        <div className="editor-topbar">
          <Link href="/redaktion/artikler" className="btn btn-ghost">
            <ChevronLeft size={16} /> Tilbage
          </Link>
          <div>
            <span className="eyebrow">{article.status}</span>
            <h1>{article.titel}</h1>
          </div>
        </div>

        <ArticleForm
          article={{
            id: article.id,
            titel: article.titel,
            manchet: article.manchet ?? "",
            slug: article.slug,
            blocks: parseBlocks(article.blocks),
            status: article.status,
            indholdstype: article.indholdstype,
            aiBrug: Array.isArray(article.aiBrug)
              ? article.aiBrug.filter((item): item is string => typeof item === "string")
              : [],
            marking,
            pinned: article.pinned,
            breaking: article.breaking,
            seoTitel: article.seoTitel ?? "",
            seoBeskrivelse: article.seoBeskrivelse ?? "",
            sprog: article.sprog,
            kategoriId: article.kategoriId ?? "",
            forfatterId: article.forfatterId ?? "",
            coverMediaId: article.coverMediaId ?? "",
            tagIds: article.tags.map((tag) => tag.id),
            geoTagIds: article.geoTags.map((tag) => tag.id),
          }}
          categories={formattedCategories}
          authors={authors}
          tags={tags}
          geoTags={geoTags}
          media={media}
          transitions={availableTransitions(article.status, session.user)}
          canPublish={can(session.user, PERMISSIONS.ARTICLE_PUBLISH)}
          canControlFrontpage={can(session.user, PERMISSIONS.FRONTPAGE_EDIT)}
        />

        {/* A-05: Rettelser i editoren for publicerede artikler */}
        <ArticleCorrections articleId={article.id} corrections={corrections} canRemove={can(session.user, PERMISSIONS.ARTICLE_PUBLISH) || can(session.user, PERMISSIONS.ARTICLE_EDIT_ALL)} />
      </main>
    </AiDock>
  );
}
