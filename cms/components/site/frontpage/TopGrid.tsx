import { effectiveVariant } from "@/lib/frontpage/layout-schema";
import { GridSegments } from "./GridSegments";
import { filledSlots, type ModuleProps } from "./slots";

export function TopGrid({ module, ctx }: ModuleProps) {
  const slots = filledSlots(ctx, module);
  if (slots.length === 0) return null;
  const variant = effectiveVariant(module);
  return (
    <section className={`fp-top-grid fp-top-grid--${variant} fp-region--${module.region} fp-segments`} aria-label={module.config.titel || "Flere tophistorier"}>
      <GridSegments module={module} ctx={ctx} slots={slots} variant={variant} cardVariant={variant === "kompakt" ? "kompakt" : "kort"} headingLevel={2} />
    </section>
  );
}
