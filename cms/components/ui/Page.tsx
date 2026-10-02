import type { ReactNode } from "react";
import { cn } from "./cn";

export type PageProps = {
  children: ReactNode;
  /** `default` 1280 px, `narrow` 880 px (formularer), `wide` 1600 px, `full` uden max-bredde. */
  width?: "default" | "narrow" | "wide" | "full";
  className?: string;
  /** Skal der være `<main>`? Sæt false hvis siden allerede ligger i en main. */
  as?: "main" | "div";
};

/** Sidens indholdsområde med ens margener. Erstatter `<main className="admin-main">`. */
export function Page({ children, width = "default", className, as = "main" }: PageProps) {
  const Tag = as;
  return <Tag className={cn("ui-page", `ui-page-${width}`, className)}>{children}</Tag>;
}

export type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Lille linje over titlen (fx sektion eller område). */
  eyebrow?: ReactNode;
  /** Ikon foran titlen (lucide, `aria-hidden`). */
  icon?: ReactNode;
  /** Badge/tæller ved siden af titlen, fx antal nye henvendelser. */
  badge?: ReactNode;
  /** Primære handlinger (knapper) til højre. */
  actions?: ReactNode;
  className?: string;
};

/** Sidehoved: titel (h1) + undertitel + handlinger. Én pr. side. */
export function PageHeader({ title, subtitle, eyebrow, icon, badge, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("ui-page-header", className)}>
      <div className="ui-page-header-main">
        {eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}
        <div className="ui-page-title-row">
          {icon ? <span className="ui-page-title-icon" aria-hidden="true">{icon}</span> : null}
          <h1 className="ui-page-title">{title}</h1>
          {badge}
        </div>
        {subtitle ? <p className="ui-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ui-page-actions">{actions}</div> : null}
    </header>
  );
}
