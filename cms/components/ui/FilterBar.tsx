import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

/** Rad med knapper/kontroller (fx visning, handlinger). Bruges som `role="toolbar"` med navn. */
export function Toolbar({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div role="toolbar" aria-label={label} className={cn("ui-toolbar", className)}>
      {children}
    </div>
  );
}

export type FilterBarProps = {
  children: ReactNode;
  /** GET-formular (filtre ligger i URL'en). Default: nuværende side. */
  action?: string;
  label?: string;
  /** Link der nulstiller filtrene (vises kun hvis angivet). */
  resetHref?: string;
  /** Tekst på indsend-knappen (default "Filtrér"). */
  submitLabel?: string;
  className?: string;
};

/** Filterlinje: søgefelt + vælgere + indsend-knap, som en GET-formular. Fungerer uden JavaScript. */
export function FilterBar({ children, action, label = "Filtre", resetHref, submitLabel = "Filtrér", className }: FilterBarProps) {
  return (
    <form method="get" action={action} role="search" aria-label={label} className={cn("ui-filterbar", className)}>
      {children}
      <div className="ui-filterbar-actions">
        <button type="submit" className="btn btn-secondary">{submitLabel}</button>
        {resetHref ? <Link href={resetHref} className="btn btn-ghost">Nulstil</Link> : null}
      </div>
    </form>
  );
}

export type FilterSelectProps = {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  className?: string;
};

/** Vælger med skjult label til FilterBar. */
export function FilterSelect({ name, label, options, value, className }: FilterSelectProps) {
  return (
    <label className={cn("ui-filterselect", className)}>
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="input" aria-label={label}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export type FilterChip = { href: string; label: ReactNode; active?: boolean; count?: number | string };

/** Hurtigfiltre som links (pille-knapper). `aria-current="true"` på den aktive. */
export function FilterChips({ chips, label, className }: { chips: FilterChip[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("ui-chips", className)}>
      {chips.map((c) => (
        <Link key={c.href} href={c.href} className="ui-chip" aria-current={c.active ? "true" : undefined}>
          {c.label}
          {c.count !== undefined ? <span className="ui-chip-count">{c.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
