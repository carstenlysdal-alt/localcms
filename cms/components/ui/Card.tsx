import type { ReactNode } from "react";
import { cn } from "./cn";

export type CardProps = {
  children?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** Handlinger i kortets hoved (knapper/links). */
  actions?: ReactNode;
  footer?: ReactNode;
  /** Ikon foran titlen. */
  icon?: ReactNode;
  /** `none` giver kant-til-kant-indhold (tabeller, lister). */
  padding?: "md" | "sm" | "none";
  /** `ai` markerer AI-flader med cyan (brug sparsomt). */
  tone?: "default" | "ai" | "warn" | "danger" | "muted";
  /** Overskriftsniveau for `title` (default 2). */
  headingLevel?: 1 | 2 | 3 | 4;
  as?: "section" | "div" | "article" | "aside";
  id?: string;
  className?: string;
  "aria-label"?: string;
};

/** Hvidt kort med valgfri titel/handlinger/fod. */
export function Card({ children, title, description, actions, footer, icon, padding = "md", tone = "default", headingLevel = 2, as: Tag = "section", id, className, ...rest }: CardProps) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3" | "h4";
  const hasHead = Boolean(title || actions || description);
  const titleId = id && title ? `${id}-title` : undefined;
  return (
    <Tag id={id} className={cn("ui-card", `ui-card-pad-${padding}`, tone !== "default" && `ui-card-${tone}`, className)} aria-labelledby={titleId} aria-label={rest["aria-label"]}>
      {hasHead ? (
        <div className="ui-card-head">
          <div className="ui-card-head-main">
            {title ? (
              <Heading id={titleId} className="ui-card-title">
                {icon ? <span className="ui-card-icon" aria-hidden="true">{icon}</span> : null}
                {title}
              </Heading>
            ) : null}
            {description ? <p className="ui-card-description">{description}</p> : null}
          </div>
          {actions ? <div className="ui-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children !== undefined && children !== null ? <div className="ui-card-body">{children}</div> : null}
      {footer ? <div className="ui-card-foot">{footer}</div> : null}
    </Tag>
  );
}
