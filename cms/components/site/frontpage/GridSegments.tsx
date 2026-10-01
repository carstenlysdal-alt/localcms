import { Fragment } from "react";
import type { Variant } from "@/lib/frontpage/types";
import { InlineBreak } from "./InlineBreak";
import { breakPlan, segmentSlots } from "./render-logic";
import type { FilledSlot } from "./slots";
import { SlotArticle } from "./SlotArticle";
import type { FrontpageRenderContext } from "./types";
import type { ModuleInstance } from "@/lib/frontpage/layout-schema";

/**
 * Kort i et grid med inline-breaks. Gridet deles i segmenter mellem break-punkterne,
 * så hver række fyldes helt ud (en række på 2 kort får 2 brede kolonner i stedet for tomme felter).
 */
export function GridSegments({ module, ctx, slots, variant, cardVariant, headingLevel, extraClass = "" }: { module: ModuleInstance; ctx: FrontpageRenderContext; slots: FilledSlot[]; variant: Variant; cardVariant: Variant; headingLevel: 2 | 3 | 4; extraClass?: string }) {
  const plan = breakPlan(slots.length, module.config.breaks);
  const segments = segmentSlots(slots.length, plan);
  return (
    <>
      {segments.map((seg) => (
        <Fragment key={seg.from}>
          <div className={`fp-grid fp-grid--${variant} fp-grid--n${Math.min(seg.to - seg.from, 6)} ${extraClass}`.trim()}>
            {slots.slice(seg.from, seg.to).map(({ assignment, article }) => (
              <div key={assignment.slotIndex} className="fp-grid-item">
                <SlotArticle assignment={assignment} article={article} variant={cardVariant} headingLevel={headingLevel} />
              </div>
            ))}
          </div>
          {seg.breaks.map((b) => (
            <div key={`${b.moduleId}-${b.occurrence}`} className="fp-grid-break">
              <InlineBreak moduleId={b.moduleId} ctx={ctx} occurrence={b.occurrence} />
            </div>
          ))}
        </Fragment>
      ))}
    </>
  );
}
