import Link from "next/link";
import { randomUUID } from "node:crypto";
import { ChevronLeft } from "lucide-react";
import { ArticleEditor } from "@/components/editor/article-editor";
import { AiDock } from "@/components/editor/ai-dock";
import { getAuthorizedUser } from "@/lib/auth";
import { emptyArticleValue, loadEditorOptions } from "@/lib/editor/load";

export default async function NewArticlePage() {
  const user = await getAuthorizedUser();
  if (!user) return null;
  const editor = await loadEditorOptions(user);
  // AI-docken vises også på nye artikler; ny samtale pr. sideindlæsning (artiklen har endnu intet id).
  const sessionId = `ny-${randomUUID()}`;
  return (
    <AiDock sessionId={sessionId} initialMessages={[]}>
      <main className="editor-page cms-page">
        <div className="cms-page-top">
          <Link href="/redaktion/artikler" className="btn btn-ghost">
            <ChevronLeft size={16} /> Tilbage
          </Link>
        </div>
        <ArticleEditor article={emptyArticleValue(user)} options={editor.options} flags={editor.flags} site={editor.site} transitions={[]} mode="page" hasUnverifiedSource={false} />
      </main>
    </AiDock>
  );
}
