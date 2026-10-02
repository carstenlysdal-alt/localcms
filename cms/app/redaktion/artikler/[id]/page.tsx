import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ArticleEditor } from "@/components/editor/article-editor";
import { ArticleCorrections } from "@/components/editor/article-corrections";
import { AiDock } from "@/components/editor/ai-dock";
import { auth, getAuthorizedUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, canEditArticle, PERMISSIONS } from "@/lib/permissions";
import { loadArticleValue, loadEditorOptions } from "@/lib/editor/load";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return null;
  const user = await getAuthorizedUser();
  if (!user) return null;
  const { id } = await params;

  const [loaded, editor, corrections] = await Promise.all([
    loadArticleValue(user, id),
    loadEditorOptions(user),
    db.correction.findMany({ where: { articleId: id, instansId: user.instansId, fjernetTid: null }, orderBy: { dato: "desc" } }),
  ]);
  if (!loaded) notFound();
  if (!canEditArticle(user, loaded.row)) {
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

  const chatSessionId = `artikel-${loaded.row.id}`;
  const chatHistory = await db.chatMessage.findMany({
    where: { sessionId: chatSessionId, instansId: user.instansId },
    orderBy: { createdAt: "asc" },
    take: 40,
  });
  const marking = loaded.row.marking as { uverificeretKilde?: unknown } | null;

  return (
    <AiDock sessionId={chatSessionId} initialMessages={chatHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))}>
      <main className="editor-page cms-page">
        <div className="cms-page-top">
          <Link href="/redaktion/artikler" className="btn btn-ghost">
            <ChevronLeft size={16} /> Tilbage
          </Link>
        </div>
        <ArticleEditor
          key={loaded.row.id}
          article={loaded.value}
          options={editor.options}
          flags={editor.flags}
          site={editor.site}
          transitions={loaded.transitions}
          mode="page"
          hasUnverifiedSource={typeof marking?.uverificeretKilde === "boolean"}
        >
          {/* A-05: Rettelser i editoren for publicerede artikler */}
          <ArticleCorrections articleId={loaded.row.id} corrections={corrections} canRemove={can(user, PERMISSIONS.ARTICLE_PUBLISH) || can(user, PERMISSIONS.ARTICLE_EDIT_ALL)} />
        </ArticleEditor>
      </main>
    </AiDock>
  );
}
