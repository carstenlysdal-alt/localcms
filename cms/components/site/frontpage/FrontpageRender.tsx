import type { ReactNode } from "react";
import "@/styles/frontpage.css";
import { FrontpageTracker } from "./FrontpageTracker";
import { ModuleRenderer } from "./ModuleRenderer";
import type { FrontpageRenderContext } from "./types";

/**
 * Fælles render af forsiden: bruges af den offentlige side og af editorens preview-rute.
 * `mode="preview"` monterer ikke målingen (preview må aldrig forurene CTR-tal).
 */
export function FrontpageRender({ ctx, mode = "live", before, after }: { ctx: FrontpageRenderContext; mode?: "live" | "preview"; before?: ReactNode; after?: ReactNode }) {
  const hasHero = ctx.modules.some((m) => m.visible && m.type === "hero");
  return (
    <div className="site-frontpage fp-front">
      {mode === "live" && <FrontpageTracker />}
      <div className="site-container fp-container">
        {before}
        {!hasHero && <h1 className="sr-only">{ctx.site.navn} – lokale nyheder fra {ctx.site.kommune}</h1>}
        <ModuleRenderer ctx={ctx} />
        {after}
      </div>
    </div>
  );
}
