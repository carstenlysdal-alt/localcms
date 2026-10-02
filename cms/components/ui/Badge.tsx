import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "primary" | "ai" | "success" | "planned" | "draft" | "review" | "danger" | "info";

export type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  /** Vis en farveprik foran teksten (status er aldrig kun farve: teksten er altid med). */
  dot?: boolean;
  icon?: ReactNode;
  /** `solid` til tæller-badges på mørk/aktiv baggrund. */
  variant?: "soft" | "solid" | "outline";
  className?: string;
  title?: string;
};

/** Lille pille til status, type og tællere. */
export function Badge({ children, tone = "neutral", dot = false, icon, variant = "soft", className, title }: BadgeProps) {
  return (
    <span className={cn("ui-badge", `ui-badge-${tone}`, variant !== "soft" && `ui-badge-${variant}`, className)} title={title}>
      {dot ? <span className="ui-badge-dot" aria-hidden="true" /> : null}
      {icon ? <span className="ui-badge-icon" aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}

export type StatusInfo = { tone: BadgeTone; label: string };

/** Artikelstatus (Prisma `Article.status`) → tone og dansk label. Ukendte værdier vises som de er (neutral). */
export function statusInfo(status: string): StatusInfo {
  switch (status) {
    case "Idé": return { tone: "draft", label: "Idé" };
    case "Udkast": return { tone: "draft", label: "Kladde" };
    case "Kladde": return { tone: "draft", label: "Kladde" };
    case "Godkendelse": return { tone: "review", label: "Til redigering" };
    case "Til redigering": return { tone: "review", label: "Til redigering" };
    case "Planlagt": return { tone: "planned", label: "Planlagt" };
    case "Publiceret": return { tone: "success", label: "Publiceret" };
    case "Distribueret": return { tone: "success", label: "Publiceret" };
    case "Afvist": return { tone: "danger", label: "Afvist" };
    case "Arkiveret": return { tone: "neutral", label: "Arkiveret" };
    // Indbakke-poster (lib/validation/status.ts)
    case "Ny": case "Modtaget": return { tone: "info", label: "Ny" };
    case "Sendt": return { tone: "planned", label: "Sendt" };
    case "Oprettet": return { tone: "draft", label: "Oprettet" };
    case "Igang": return { tone: "review", label: "I gang" };
    case "Besvaret": return { tone: "success", label: "Besvaret" };
    case "DelvistBesvaret": return { tone: "review", label: "Delvist besvaret" };
    case "ArtikelOprettet": return { tone: "success", label: "Artikel oprettet" };
    case "Booket": return { tone: "planned", label: "Booket" };
    case "BriefIndsendt": return { tone: "review", label: "Brief indsendt" };
    case "UdkastKlar": return { tone: "draft", label: "Udkast klar" };
    case "Faktatjek": return { tone: "review", label: "Faktatjek" };
    case "RettelserAnmodet": return { tone: "danger", label: "Rettelser anmodet" };
    case "Godkendt": return { tone: "success", label: "Godkendt" };
    case "UnderBehandling": return { tone: "review", label: "Under behandling" };
    case "BrugtIArtikel": return { tone: "success", label: "Brugt i artikel" };
    default: return { tone: "neutral", label: status };
  }
}

/** Statuschip for artikler og indbakke-poster (kladde · til redigering · planlagt · publiceret · afvist). */
export function StatusChip({ status, className }: { status: string; className?: string }) {
  const info = statusInfo(status);
  return <Badge tone={info.tone} dot className={className}>{info.label}</Badge>;
}
