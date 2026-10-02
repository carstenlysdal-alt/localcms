import { cn } from "@/components/ui/cn";

/**
 * Lille trendlinje til KPI-kort. Dekorativ + tekstalternativ (`label`). Ingen akser/tal i selve grafikken, så den kan
 * skaleres frit (preserveAspectRatio="none").
 */
export function Sparkline({ values, label, className, tone = 1 }: { values: number[]; label: string; className?: string; tone?: 1 | 2 | 3 | 4 | 5 | 6 }) {
  const W = 120;
  const H = 32;
  const pad = 3;
  if (values.length < 2 || Math.max(...values) <= 0) {
    return <span className={cn("ui-spark-empty", className)}>Ingen udvikling at vise</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (W - pad * 2), H - pad - ((v - min) / span) * (H - pad * 2)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const last = pts[pts.length - 1];
  return (
    <svg className={cn("ui-spark", className)} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <title>{label}</title>
      <path d={d} className={`ui-chart-line ui-chart-s${tone}`} vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r={2.5} className={`ui-chart-dot ui-chart-s${tone}`} />
    </svg>
  );
}
