import Link from "next/link";
import { filledSlots, type ModuleProps } from "./slots";
import { labelFor, slotAttrs } from "./SlotArticle";

/** Tekstlinje(r) øverst. Skjules helt når der ingen frisk breaking er. */
export function BreakingBar({ module, ctx }: ModuleProps) {
  const slots = filledSlots(ctx, module);
  if (slots.length === 0) return null;
  return (
    <section className="fp-breaking" aria-label="Lige nu">
      <ul className="fp-breaking-list">
        {slots.map(({ assignment, article }) => (
          <li key={assignment.slotIndex} className="fp-breaking-item" {...slotAttrs(assignment)}>
            <span className="fp-breaking-pill">Lige nu</span>
            {labelFor(assignment, article, true)}
            <Link href={article.href} className="fp-breaking-link">
              {article.titel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
