import { cn } from "./cn";

export type SkeletonProps = {
  variant?: "line" | "block" | "circle";
  /** Bredde som procent-trin (kun faste trin, så der ikke skal bruges inline styles). */
  width?: 25 | 50 | 75 | 100;
  className?: string;
};

/** Pladsholder under indlæsning. Dekorativ (aria-hidden) — omslut med <SkeletonGroup> der annoncerer "Indlæser". */
export function Skeleton({ variant = "line", width = 100, className }: SkeletonProps) {
  return <span aria-hidden="true" className={cn("ui-skeleton", `ui-skeleton-${variant}`, `ui-w-${width}`, className)} />;
}

export function SkeletonGroup({ children, label = "Indlæser…", className }: { children: React.ReactNode; label?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn("ui-skeleton-group", className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** Færdig skeleton til en tabel (n rækker). */
export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <SkeletonGroup>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="ui-skeleton-row">
          <Skeleton variant="circle" width={25} className="ui-skeleton-avatar" />
          <Skeleton width={75} />
          <Skeleton width={25} />
        </div>
      ))}
    </SkeletonGroup>
  );
}
