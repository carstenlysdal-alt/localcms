import { getModuleDef } from "@/lib/frontpage/modules";
import { BreakingBar } from "./BreakingBar";
import { BreakModule } from "./InlineBreak";
import { Hero } from "./Hero";
import { FraKommunenPolitiet, KalenderStrip, Opslagstavle } from "./dynamic";
import { groupByRegion } from "./render-logic";
import { Debat, DitOmraade, SektionRail } from "./rails";
import { SenesteNyt } from "./SenesteNyt";
import type { ModuleProps } from "./slots";
import { TopGrid } from "./TopGrid";
import type { FrontpageRenderContext } from "./types";

/** Modultype -> komponent. Ukendte typer (eller typer uden komponent) ignoreres sikkert. */
export function ModuleView(props: ModuleProps) {
  if (!getModuleDef(props.module.type)) return null;
  switch (props.module.type) {
    case "hero":
      return <Hero {...props} />;
    case "top-grid":
      return <TopGrid {...props} />;
    case "breaking-bar":
      return <BreakingBar {...props} />;
    case "seneste-nyt":
      return <SenesteNyt {...props} />;
    case "dit-omraade":
      return <DitOmraade {...props} />;
    case "sektion-rail":
      return <SektionRail {...props} />;
    case "partner-break":
    case "sponsoreret-break":
    case "ad-break":
    case "egen-promo":
      return <BreakModule {...props} />;
    case "kalender-strip":
      return <KalenderStrip {...props} />;
    case "fra-kommunen":
    case "fra-politiet":
      return <FraKommunenPolitiet {...props} />;
    case "debat":
      return <Debat {...props} />;
    case "opslagstavle":
      return <Opslagstavle {...props} />;
    default:
      return null;
  }
}

export function ModuleRenderer({ ctx }: { ctx: FrontpageRenderContext }) {
  const rows = groupByRegion(ctx.modules);
  return (
    <>
      {rows.map((row) =>
        row.kind === "full" ? (
          <div key={row.module.id} className={`fp-row fp-row--${row.module.type}`} data-module-id={row.module.id}>
            <ModuleView module={row.module} ctx={ctx} />
          </div>
        ) : (
          <div key={`${row.main[0].id}+${row.sidebar[0].id}`} className="fp-row fp-row--split">
            <div className="fp-split-main">
              {row.main.map((m) => (
                <div key={m.id} data-module-id={m.id}>
                  <ModuleView module={m} ctx={ctx} />
                </div>
              ))}
            </div>
            <div className="fp-split-side">
              {row.sidebar.map((m) => (
                <div key={m.id} data-module-id={m.id}>
                  <ModuleView module={m} ctx={ctx} />
                </div>
              ))}
            </div>
          </div>
        ),
      )}
    </>
  );
}
