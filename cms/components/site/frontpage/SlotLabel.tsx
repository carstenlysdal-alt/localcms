import { AlertCircle, Bot, Handshake, Megaphone, MessageSquare } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Mærkning på forsideslots. Vises ALTID (også for Uafhængig) som tekst + ikon/form, aldrig kun farve.
 * Teksten kommer fra placeringens label (udledt af artiklen i backend), ikke fra klienten.
 */
export interface SlotLabelProps {
  tekst: string;
  indholdstype: string;
  sponsor?: string;
  afsender?: string;
  godkendtAf?: string;
  /** Lys variant til mørke flader (hero, breaking-bar). */
  onDark?: boolean;
}

export function SlotLabel({ tekst, indholdstype, sponsor, afsender, godkendtAf, onDark }: SlotLabelProps): ReactNode {
  const extra =
    indholdstype === "Partner" || indholdstype === "Sponsoreret" ? sponsor : indholdstype === "Brugerindsendt" || indholdstype === "PR" ? afsender : indholdstype === "AI-assisteret" && godkendtAf ? `godkendt af ${godkendtAf}` : undefined;
  const full = extra ? `${tekst} · ${extra}` : tekst;
  const cls = (kind: string) => `fp-label fp-label--${kind}${onDark ? " fp-label--on-dark" : ""}`;
  const icon = { size: 14, "aria-hidden": true } as const;
  switch (indholdstype) {
    case "Partner":
      return (
        <span className={`site-badge site-badge-partner ${cls("partner")}`}>
          <Handshake {...icon} />
          <span>{full}</span>
        </span>
      );
    case "Sponsoreret":
      return (
        <span className={`site-badge site-badge-ad ${cls("ad")}`}>
          <AlertCircle {...icon} />
          <span>{full}</span>
        </span>
      );
    case "Brugerindsendt":
      return (
        <span className={`site-badge site-badge-user ${cls("user")}`}>
          <MessageSquare {...icon} />
          <span>{full}</span>
        </span>
      );
    case "AI-assisteret":
      return (
        <span className={`site-badge site-badge-ai ${cls("ai")}`}>
          <Bot {...icon} />
          <span>{full}</span>
        </span>
      );
    case "PR":
      return (
        <span className={`site-badge site-badge-pr ${cls("pr")}`}>
          <Megaphone {...icon} />
          <span>{full}</span>
        </span>
      );
    default:
      return (
        <span className={cls("independent")}>
          <span className="fp-label-dot" aria-hidden="true" />
          <span>{full}</span>
        </span>
      );
  }
}
