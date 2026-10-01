import { effectiveVariant } from "@/lib/frontpage/layout-schema";
import { GridSegments } from "./GridSegments";
import { moduleTitle } from "./render-logic";
import { SectionHead } from "./SectionHead";
import { filledSlots, type ModuleProps } from "./slots";

function Rail({ module, ctx, title, href, linkText, hideWhenEmpty = true }: ModuleProps & { title: string; href?: string; linkText?: string; hideWhenEmpty?: boolean }) {
  const slots = filledSlots(ctx, module);
  if (slots.length === 0 && hideWhenEmpty) return null;
  const variant = effectiveVariant(module);
  return (
    <section className="fp-rail fp-segments" aria-labelledby={`fp-${module.id}-h`}>
      <SectionHead id={`fp-${module.id}-h`} title={title} href={href} linkText={linkText} />
      <GridSegments module={module} ctx={ctx} slots={slots} variant={variant} cardVariant={variant} headingLevel={3} extraClass="fp-grid--rail" />
    </section>
  );
}

export function DitOmraade(p: ModuleProps) {
  const slug = p.module.config.omraadeSlug;
  return <Rail {...p} title={moduleTitle(p.module, "Dit område")} href={slug ? `/omraade/${slug}` : "/omraade"} linkText="Se alle områder" />;
}

export function SektionRail(p: ModuleProps) {
  const slug = p.module.config.sektionSlug;
  const name = slug ? p.ctx.extras.sectionNames[slug] ?? slug : undefined;
  return <Rail {...p} title={moduleTitle(p.module, name ?? "Nyheder")} href={slug ? `/${slug}` : undefined} linkText={name ? `Se alle i ${name}` : "Se alle"} />;
}

export function Debat(p: ModuleProps) {
  return <Rail {...p} title={moduleTitle(p.module, "Debat")} href="/debat" linkText="Se al debat" />;
}
