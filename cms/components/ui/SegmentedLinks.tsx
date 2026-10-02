import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type SegmentedItem = { href: string; label: ReactNode; active?: boolean };

/** Segmenteret valg som links (fx tidsperiode 7/28/90 dage). Ligger i URL'en, så filteret kan deles og virker uden JavaScript. */
export function SegmentedLinks({ items, label, className }: { items: SegmentedItem[]; label: string; className?: string }) {
  return (
    <nav aria-label={label} className={cn("ui-segmented", className)}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.active ? "true" : undefined} scroll={false}>{item.label}</Link>
      ))}
    </nav>
  );
}
