import type { ModuleInstance } from "@/lib/frontpage/layout-schema";
import type { SlotAssignment } from "@/lib/frontpage/types";
import type { PublicArticleSummary } from "@/lib/site-queries";
import { sortedSlots } from "./render-logic";
import type { FrontpageRenderContext } from "./types";

export interface FilledSlot {
  assignment: SlotAssignment;
  article: PublicArticleSummary;
}

/** Udfyldte slots for et modul. Placeringer uden artikel eller uden synlig mærkning udelades (regel: ingen label = vises ikke). */
export function filledSlots(ctx: FrontpageRenderContext, module: ModuleInstance): FilledSlot[] {
  const out: FilledSlot[] = [];
  for (const a of sortedSlots(ctx.assignments[module.id])) {
    const article = ctx.articles[a.articleId];
    if (!article) continue;
    if (!a.label?.tekst || a.label.synlig !== true) continue;
    out.push({ assignment: a, article });
  }
  return out.slice(0, module.slots);
}

export interface ModuleProps {
  module: ModuleInstance;
  ctx: FrontpageRenderContext;
  /** Renderes som inline-break i en vært (andre marginer). */
  inline?: boolean;
  occurrence?: number;
}
