import Link from "next/link";
import { Fragment } from "react";
import { effectiveVariant } from "@/lib/frontpage/layout-schema";
import { breakPlan, breaksAfter, moduleTitle } from "./render-logic";
import { InlineBreak } from "./InlineBreak";
import { SectionHead } from "./SectionHead";
import { filledSlots, type ModuleProps } from "./slots";
import { SlotArticle } from "./SlotArticle";

/** Altid kronologisk (backend sorterer publiceretTid desc; rækkefølgen bevares her). */
export function SenesteNyt({ module, ctx }: ModuleProps) {
  const slots = filledSlots(ctx, module);
  const title = moduleTitle(module, "Seneste nyt");
  const variant = effectiveVariant(module);
  const plan = breakPlan(slots.length, module.config.breaks);
  const sektion = module.config.sektionSlug;
  return (
    <section className="fp-panel fp-wire" aria-labelledby={`fp-${module.id}-h`}>
      <SectionHead id={`fp-${module.id}-h`} title={title} href={sektion ? `/${sektion}` : "/nyheder"} linkText="Se alle nyheder" />
      {slots.length === 0 ? (
        <p className="fp-empty">
          Ingen nyheder endnu. <Link href="/indsend">Tip redaktionen</Link>
        </p>
      ) : (
        <div className="fp-wire-list">
          {slots.map(({ assignment, article }, i) => (
            <Fragment key={assignment.slotIndex}>
              <SlotArticle assignment={assignment} article={article} variant={variant === "tekstlinje" ? "tekstlinje" : "liste"} headingLevel={3} />
              {breaksAfter(plan, i + 1).map((b) => (
                <div key={`${b.moduleId}-${b.occurrence}`} className="fp-list-break">
                  <InlineBreak moduleId={b.moduleId} ctx={ctx} occurrence={b.occurrence} />
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </section>
  );
}
