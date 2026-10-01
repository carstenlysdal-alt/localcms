import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MODULE_REGISTRY } from "@/lib/frontpage/modules";
import { effectiveVariant } from "@/lib/frontpage/layout-schema";
import { AdBreakView } from "./AdBreakView";
import { adIndex } from "./render-logic";
import { filledSlots, type ModuleProps } from "./slots";
import { SlotArticle } from "./SlotArticle";

/** Annonce-break: ingen aktiv kampagne = skjult. */
export function AdBreak({ module, ctx, occurrence = 0 }: ModuleProps) {
  const idx = adIndex(ctx.modules, module.id, occurrence);
  const formats: string[] | null = module.config.adFormat ? [module.config.adFormat] : null;
  const pool = formats ? ctx.extras.ads.filter((a) => formats.includes(a.format)) : ctx.extras.ads;
  const campaign = idx >= 0 ? pool[idx] : undefined;
  if (!campaign) return null;
  const v = effectiveVariant(module);
  return <AdBreakView campaign={campaign} variant={v === "kort" || v === "tekstlinje" ? v : "kompakt"} />;
}

function ArticleBreak({ module, ctx, kind, heading }: ModuleProps & { kind: "partner" | "sponsoreret"; heading: string }) {
  const slots = filledSlots(ctx, module);
  if (slots.length === 0) return null; // skjult når tom/kvoteloft nået
  return (
    <aside className={`fp-break fp-break--${kind}`} aria-label={module.config.titel || heading}>
      <p className="fp-break-kicker">
        <span className="fp-break-kicker-text">{module.config.titel || heading}</span>
      </p>
      <div className="fp-break-items">
        {slots.map(({ assignment, article }) => (
          <SlotArticle key={assignment.slotIndex} assignment={assignment} article={article} headingLevel={3} />
        ))}
      </div>
    </aside>
  );
}

export const SponsoreretBreak = (p: ModuleProps) => <ArticleBreak {...p} kind="sponsoreret" heading="Sponsoreret indhold" />;
export const PartnerBreak = (p: ModuleProps) => <ArticleBreak {...p} kind="partner" heading="Partnerindhold" />;

const PROMOS = {
  stoet: { href: "/bliv-stoette", title: "Støt den lokale journalistik", text: "Din støtte holder redaktionen uafhængig og lokal.", cta: "Se hvordan du støtter" },
  nyhedsbrev: { href: "/nyhedsbrev", title: "Få nyhederne i din indbakke", text: "Et nyhedsbrev med de vigtigste lokale historier.", cta: "Tilmeld nyhedsbrev" },
  indsend: { href: "/indsend", title: "Har du et tip eller en historie?", text: "Send det til redaktionen. Vi læser alt.", cta: "Send et tip" },
} as const;

export function EgenPromo({ module }: ModuleProps) {
  const p = PROMOS[module.config.promoKind ?? "stoet"];
  return (
    <aside className="fp-break fp-break--promo" aria-label="Fra redaktionen">
      <p className="fp-break-kicker">
        <span className="fp-label fp-label--independent">
          <span className="fp-label-dot" aria-hidden="true" />
          <span>{MODULE_REGISTRY["egen-promo"].fastMaerkning}</span>
        </span>
      </p>
      <div className="fp-promo-body">
        <div>
          <p className="fp-promo-title">{module.config.titel || p.title}</p>
          {module.variant !== "tekstlinje" && <p className="fp-promo-text">{p.text}</p>}
        </div>
        <Link href={p.href} className="fp-promo-cta">
          {p.cta} <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
