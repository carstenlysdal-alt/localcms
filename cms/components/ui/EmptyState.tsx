import type { ReactNode } from "react";
import { cn } from "./cn";

export type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  /** Knap/link til næste skridt. */
  action?: ReactNode;
  /** `inline` til tomme tilstande inde i tabeller/lister. */
  variant?: "card" | "inline";
  className?: string;
};

export function EmptyState({ title, description, icon, action, variant = "card", className }: EmptyStateProps) {
  return (
    <div className={cn("ui-empty", `ui-empty-${variant}`, className)}>
      {icon ? <span className="ui-empty-icon" aria-hidden="true">{icon}</span> : null}
      <p className="ui-empty-title">{title}</p>
      {description ? <p className="ui-empty-text">{description}</p> : null}
      {action ? <div className="ui-empty-action">{action}</div> : null}
    </div>
  );
}
