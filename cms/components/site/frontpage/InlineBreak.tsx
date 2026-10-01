import { AdBreak, EgenPromo, PartnerBreak, SponsoreretBreak } from "./breaks";
import type { ModuleProps } from "./slots";

/** Render et break-modul (bruges både som egen række og inline i en vært). */
export function BreakModule(props: ModuleProps) {
  switch (props.module.type) {
    case "ad-break":
      return <AdBreak {...props} />;
    case "sponsoreret-break":
      return <SponsoreretBreak {...props} />;
    case "partner-break":
      return <PartnerBreak {...props} />;
    case "egen-promo":
      return <EgenPromo {...props} />;
    default:
      return null;
  }
}

/** Inline-break-modul slået op via id i layoutet. Ukendt/ikke-break id giver null (sikkert). */
export function InlineBreak({ moduleId, ctx, occurrence }: { moduleId: string; ctx: ModuleProps["ctx"]; occurrence: number }) {
  const m = ctx.modules.find((x) => x.id === moduleId);
  if (!m || !m.visible) return null;
  // Gentagelser (repeatEvery) giver kun mening for annoncer, som roterer kampagne; øvrige vises én gang.
  if (occurrence > 0 && m.type !== "ad-break") return null;
  return <BreakModule module={m} ctx={ctx} inline occurrence={occurrence} />;
}
