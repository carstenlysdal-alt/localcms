import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "./cn";

export function Stack({ children, gap = "md", className }: { children: ReactNode; gap?: "sm" | "md" | "lg"; className?: string }) {
  return <div className={cn("ui-stack", `ui-gap-${gap}`, className)}>{children}</div>;
}

export function Row({ children, gap = "md", justify, wrap = true, className }: { children: ReactNode; gap?: "sm" | "md" | "lg"; justify?: "between" | "end"; wrap?: boolean; className?: string }) {
  return <div className={cn("ui-row", `ui-gap-${gap}`, justify && `ui-justify-${justify}`, !wrap && "ui-nowrap", className)}>{children}</div>;
}

export type GridProps = {
  children: ReactNode;
  /** Antal kolonner på bred skærm; falder automatisk til 2 og 1 på mindre. `auto` = så mange som der er plads til. */
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | "auto";
  gap?: "sm" | "md" | "lg";
  className?: string;
};

export function Grid({ children, cols = "auto", gap = "md", className }: GridProps) {
  return <div className={cn("ui-grid", `ui-cols-${cols}`, `ui-gap-${gap}`, className)}>{children}</div>;
}

/** Hoved + sidepanel (fx liste + formular). Sidepanelet lægger sig under på mobil. */
export function Split({ main, aside, asideWidth = "md", className }: { main: ReactNode; aside: ReactNode; asideWidth?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <div className={cn("ui-split", `ui-split-${asideWidth}`, className)}>
      <div className="ui-split-main">{main}</div>
      <div className="ui-split-aside">{aside}</div>
    </div>
  );
}

export type NoticeProps = {
  children: ReactNode;
  tone?: "info" | "success" | "warn" | "danger";
  title?: string;
  className?: string;
};

/** Inline besked. `danger`/`warn` annonceres straks (role=alert), de øvrige høfligt (role=status). */
export function Notice({ children, tone = "info", title, className }: NoticeProps) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "warn" ? AlertTriangle : tone === "danger" ? XCircle : Info;
  return (
    <div className={cn("ui-notice", `ui-notice-${tone}`, className)} role={tone === "danger" || tone === "warn" ? "alert" : "status"}>
      <Icon size={18} aria-hidden="true" className="ui-notice-icon" />
      <div className="ui-notice-body">
        {title ? <p className="ui-notice-title">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

export type FieldProps = {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

/** Formularfelt: label + kontrol + hjælpetekst/fejl. Kontrollen skal selv have `id={htmlFor}` (og gerne aria-describedby={`${htmlFor}-hint`}). */
export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn("field ui-field", className)}>
      <label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ui-required" aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint ? <p id={`${htmlFor}-hint`} className="ui-field-hint">{hint}</p> : null}
      {error ? <p id={`${htmlFor}-error`} className="ui-field-error" role="alert">{error}</p> : null}
    </div>
  );
}
