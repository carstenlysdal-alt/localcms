import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, PlugZap } from "lucide-react";
import { cn } from "./cn";

export type StatDelta = {
  /** Fortegnsbærende ændring, fx 12.4 (procent) eller "+120". Tal formateres som procent. */
  value: number | string;
  /** Hvis ikke angivet udledes retningen af fortegnet. */
  direction?: "up" | "down" | "flat";
  /** Tekst efter ændringen, fx "mod forrige 28 dage". */
  label?: string;
  /** Sæt true når "ned" er godt (fx fejlrate). */
  invert?: boolean;
};

export type StatCardProps = {
  label: string;
  /** Det store tal (allerede formateret). Udelad ved `unavailable`/`loading`. */
  value?: ReactNode;
  delta?: StatDelta;
  /** Understøttende tekst under tallet. */
  hint?: ReactNode;
  icon?: ReactNode;
  /** Lille graf (fx <Sparkline/>) i kortets bund. */
  chart?: ReactNode;
  /** Ingen datakilde endnu: viser ærligt "ikke tilsluttet" med forklaring i stedet for et tal. */
  unavailable?: string;
  /** Datakilden findes, men der er ingen data i perioden. */
  empty?: string;
  loading?: boolean;
  /** Overskriftsniveau er altid en `p` — tal-kort er ikke dokumentstruktur. */
  className?: string;
};

function directionOf(delta: StatDelta): "up" | "down" | "flat" {
  if (delta.direction) return delta.direction;
  const n = typeof delta.value === "number" ? delta.value : Number.parseFloat(String(delta.value).replace(",", "."));
  if (!Number.isFinite(n) || n === 0) return "flat";
  return n > 0 ? "up" : "down";
}

function formatDelta(delta: StatDelta): string {
  if (typeof delta.value === "string") return delta.value;
  const abs = Math.abs(delta.value);
  const text = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(abs);
  return `${delta.value > 0 ? "+" : delta.value < 0 ? "−" : ""}${text} %`;
}

/** Nøgletal-kort (KPI). Tilstande: normal · loading · empty · unavailable ("kobles til når sporing er slået til"). */
export function StatCard({ label, value, delta, hint, icon, chart, unavailable, empty, loading = false, className }: StatCardProps) {
  if (loading) {
    return (
      <div className={cn("ui-stat", "ui-stat-loading", className)} role="status" aria-label={`${label}: indlæser`}>
        <div className="ui-skeleton ui-skeleton-line ui-w-50" aria-hidden="true" />
        <div className="ui-skeleton ui-skeleton-value" aria-hidden="true" />
        <div className="ui-skeleton ui-skeleton-line ui-w-75" aria-hidden="true" />
      </div>
    );
  }
  if (unavailable) {
    return (
      <div className={cn("ui-stat", "ui-stat-unavailable", className)}>
        <div className="ui-stat-head">
          <span className="ui-stat-label">{label}</span>
          <span className="ui-stat-icon" aria-hidden="true"><PlugZap size={16} /></span>
        </div>
        <p className="ui-stat-unavailable-title">Kobles til når sporing er slået til</p>
        <p className="ui-stat-hint">{unavailable}</p>
      </div>
    );
  }
  const dir = delta ? directionOf(delta) : null;
  const good = delta && dir && dir !== "flat" ? (delta.invert ? dir === "down" : dir === "up") : null;
  return (
    <div className={cn("ui-stat", className)}>
      <div className="ui-stat-head">
        <span className="ui-stat-label">{label}</span>
        {icon ? <span className="ui-stat-icon" aria-hidden="true">{icon}</span> : null}
      </div>
      {empty ? (
        <p className="ui-stat-empty">{empty}</p>
      ) : (
        <p className="ui-stat-value">{value}</p>
      )}
      {delta && !empty ? (
        <p className={cn("ui-stat-delta", good === true && "is-good", good === false && "is-bad")}>
          {dir === "up" ? <ArrowUpRight size={14} aria-hidden="true" /> : dir === "down" ? <ArrowDownRight size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
          <span>{formatDelta(delta)}</span>
          {delta.label ? <span className="ui-stat-delta-label">{delta.label}</span> : null}
        </p>
      ) : null}
      {hint ? <p className="ui-stat-hint">{hint}</p> : null}
      {chart ? <div className="ui-stat-chart">{chart}</div> : null}
    </div>
  );
}
