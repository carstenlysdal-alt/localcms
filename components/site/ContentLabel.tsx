import type { ReactNode } from "react";
import { Handshake, MessageSquare, Bot, Megaphone, AlertCircle } from "lucide-react";

type ContentLabelProps = {
  indholdstype: "Uafhængig" | "Partner" | "Sponsoreret" | "Brugerindsendt" | "AI-assisteret" | "PR" | string;
  sponsor?: string;
  afsender?: string;
  godkendtAf?: string;
};

export function ContentLabel({ indholdstype, sponsor, afsender, godkendtAf }: ContentLabelProps): ReactNode {
  if (indholdstype === "Uafhængig" || !indholdstype) {
    return null;
  }

  if (indholdstype === "Partner") {
    const text = sponsor ? `Finansieret af ${sponsor}` : "Finansieret af partner";
    return (
      <span className="site-badge site-badge-partner" aria-label={text}>
        <Handshake size={13} aria-hidden="true" />
        <span>{text}</span>
      </span>
    );
  }

  if (indholdstype === "Sponsoreret") {
    const text = sponsor ? `ANNONCE · ${sponsor}` : "ANNONCE";
    return (
      <span className="site-badge site-badge-ad" aria-label={`Annonce fra ${sponsor || "sponsor"}`}>
        <AlertCircle size={13} aria-hidden="true" />
        <span>{text}</span>
      </span>
    );
  }

  if (indholdstype === "Brugerindsendt") {
    const text = afsender ? `Indsendt af ${afsender}` : "Indsendt af borger";
    return (
      <span className="site-badge site-badge-user" aria-label={text}>
        <MessageSquare size={13} aria-hidden="true" />
        <span>{text}</span>
      </span>
    );
  }

  if (indholdstype === "AI-assisteret") {
    const text = godkendtAf ? `AI-assisteret · Godkendt af ${godkendtAf}` : "AI-assisteret";
    return (
      <span className="site-badge site-badge-ai" aria-label={text}>
        <Bot size={13} aria-hidden="true" />
        <span>{text}</span>
      </span>
    );
  }

  if (indholdstype === "PR") {
    const text = afsender ? `Pressemeddelelse fra ${afsender}` : "Pressemeddelelse";
    return (
      <span className="site-badge site-badge-pr" aria-label={text}>
        <Megaphone size={13} aria-hidden="true" />
        <span>{text}</span>
      </span>
    );
  }

  return null;
}
