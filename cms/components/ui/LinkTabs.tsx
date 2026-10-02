import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type LinkTabItem = {
  href: string;
  label: ReactNode;
  count?: number | string;
  active?: boolean;
  /** Prik foran label (fx by-farve): send en <CityDot/>. */
  lead?: ReactNode;
};

/**
 * Faner der er links (URL-baserede filtre/sider). Server-venlig: ingen state.
 * Semantik: `<nav aria-label>` med `aria-current="page"` på den aktive (bevidst ikke role=tab — fanerne skifter side).
 */
export function LinkTabs({ items, label, className }: { items: LinkTabItem[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("ui-tablist ui-linktabs", className)}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="ui-tab" aria-current={item.active ? "page" : undefined}>
          {item.lead}
          {item.label}
          {item.count !== undefined ? <span className="ui-tab-count">{item.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
