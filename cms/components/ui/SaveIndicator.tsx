import { AlertCircle, Check, Loader2, Pencil } from "lucide-react";
import { cn } from "./cn";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type SaveIndicatorProps = {
  status: SaveStatus;
  /** Tidspunkt for seneste gemning (vises som "Sidst gemt 14:32"). */
  savedAt?: Date | string | number | null;
  /** Fejltekst ved `error`. */
  error?: string;
  className?: string;
};

const clock = new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Copenhagen" });

export function saveLabel(status: SaveStatus, savedAt?: SaveIndicatorProps["savedAt"], error?: string): string {
  switch (status) {
    case "saving": return "Gemmer…";
    case "dirty": return "Ikke gemt";
    case "error": return error ? `Kunne ikke gemme: ${error}` : "Kunne ikke gemme";
    case "saved":
    case "idle": {
      if (!savedAt) return status === "saved" ? "Gemt" : "Ikke gemt endnu";
      const d = savedAt instanceof Date ? savedAt : new Date(savedAt);
      return Number.isNaN(d.getTime()) ? "Gemt" : `Sidst gemt ${clock.format(d)}`;
    }
  }
}

/** Autosave-status. `aria-live="polite"` så skærmlæsere hører ændringer uden at blive afbrudt; fejl er `assertive`. */
export function SaveIndicator({ status, savedAt, error, className }: SaveIndicatorProps) {
  const Icon = status === "saving" ? Loader2 : status === "error" ? AlertCircle : status === "dirty" ? Pencil : Check;
  return (
    <p className={cn("ui-save", `ui-save-${status}`, className)} role="status" aria-live={status === "error" ? "assertive" : "polite"} aria-atomic="true">
      <Icon size={14} aria-hidden="true" className={status === "saving" ? "ui-spin" : undefined} />
      <span>{saveLabel(status, savedAt, error)}</span>
    </p>
  );
}
