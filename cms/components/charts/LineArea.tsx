"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChartFrame, ChartLegend } from "./ChartFrame";
import { ChartTip } from "./ChartTip";
import { SERIES_CLASS, formatValue, niceScale, useElementWidth } from "./chart-utils";

export type LineSeries = { id: string; label: string; values: Array<number | null> };

export type LineAreaProps = {
  title: string;
  description?: string;
  /** X-akse: én etiket pr. punkt (fx "12. okt."). */
  categories: string[];
  series: LineSeries[];
  /** Udfyld området under den første serie. */
  area?: boolean;
  valueKind?: "number" | "percent" | "compact";
  /** Højde i px (default 240). */
  height?: number;
  /** Vises i stedet for diagrammet når alle værdier er 0/null. */
  emptyText?: string;
  className?: string;
};

const M = { top: 12, right: 12, bottom: 28, left: 44 };

/** Linje-/arealdiagram i ren SVG. Pil venstre/højre (eller mus) viser værdier; tabel-fallback under. */
export function LineArea({ title, description, categories, series, area = true, valueKind = "number", height = 240, emptyText = "Ingen data i perioden.", className }: LineAreaProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = categories.length;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const hasData = n > 0 && all.some((v) => v > 0);
  const { max, ticks } = niceScale(Math.max(0, ...all));
  const innerW = Math.max(10, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const x = (i: number) => M.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / max) * innerH;
  const tickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 80))));

  const paths = series.map((s) => {
    let d = "";
    let pen = false;
    s.values.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  });

  const areaPath = area && series[0]
    ? (() => {
        const pts = series[0].values.map((v, i) => [x(i), y(v ?? 0)] as const);
        if (!pts.length) return "";
        return `M${pts[0][0].toFixed(1)} ${y(0).toFixed(1)}${pts.map(([px, py]) => `L${px.toFixed(1)} ${py.toFixed(1)}`).join("")}L${pts[pts.length - 1][0].toFixed(1)} ${y(0).toFixed(1)}Z`;
      })()
    : "";

  function indexFromPointer(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    if (n <= 1) return 0;
    return Math.min(n - 1, Math.max(0, Math.round(((px - M.left) / innerW) * (n - 1))));
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (!n) return;
    if (e.key === "ArrowRight") { e.preventDefault(); setActive((i) => (i === null ? 0 : Math.min(n - 1, i + 1))); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setActive((i) => (i === null ? n - 1 : Math.max(0, i - 1))); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(n - 1); }
    else if (e.key === "Escape") setActive(null);
  }

  const liveText = active !== null
    ? `${categories[active]}: ${series.map((s) => `${s.label} ${s.values[active] === null ? "ingen data" : formatValue(s.values[active] as number, valueKind)}`).join(", ")}`
    : "";
  const summary = hasData
    ? `${title}. ${series.map((s) => { const vals = s.values.filter((v): v is number => v !== null); return `${s.label}: højest ${formatValue(Math.max(...vals), valueKind)}, senest ${formatValue(vals[vals.length - 1] ?? 0, valueKind)}`; }).join(". ")}. Brug piletaster til at gennemgå punkterne.`
    : `${title}. ${emptyText}`;

  const table = {
    caption: title,
    headers: ["Periode", ...series.map((s) => s.label)],
    rows: categories.map((c, i) => [c, ...series.map((s) => (s.values[i] === null ? "–" : formatValue(s.values[i] as number, valueKind)))]),
  };

  return (
    <ChartFrame
      title={title}
      description={description}
      className={className}
      legend={series.length > 1 ? <ChartLegend items={series.map((s, i) => ({ id: s.id, label: s.label, swatch: `ui-swatch-s${(i % 6) + 1}` }))} /> : undefined}
      table={table}
      live={liveText}
    >
      <div ref={ref} className="ui-chart-canvas">
        {hasData ? (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="group"
            aria-label={summary}
            tabIndex={0}
            className="ui-chart-svg"
            onPointerMove={(e) => setActive(indexFromPointer(e))}
            onPointerLeave={() => setActive(null)}
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
          >
            <title>{title}</title>
            {ticks.map((t) => (
              <g key={t}>
                <line className="ui-chart-grid" x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} />
                <text className="ui-chart-text" x={M.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">{formatValue(t, valueKind === "percent" ? "percent" : "compact")}</text>
              </g>
            ))}
            {categories.map((c, i) => (i % tickEvery === 0 ? (
              <text key={i} className="ui-chart-text" x={x(i)} y={height - 8} textAnchor="middle">{c}</text>
            ) : null))}
            {areaPath ? <path d={areaPath} className={`ui-chart-area ${SERIES_CLASS(0)}`} /> : null}
            {paths.map((d, i) => <path key={series[i].id} d={d} className={`ui-chart-line ${SERIES_CLASS(i)}`} />)}
            {n <= 40 ? series.map((s, si) => s.values.map((v, i) => (v === null ? null : <circle key={`${s.id}-${i}`} cx={x(i)} cy={y(v)} r={active === i ? 4.5 : 2.5} className={`ui-chart-dot ${SERIES_CLASS(si)}`} />))) : null}
            {active !== null ? (
              <g aria-hidden="true">
                <line className="ui-chart-cursor" x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + innerH} />
                <ChartTip x={x(active)} y={M.top} maxX={width} title={categories[active]} lines={series.map((s) => `${s.label}: ${s.values[active] === null ? "–" : formatValue(s.values[active] as number, valueKind)}`)} />
              </g>
            ) : null}
          </svg>
        ) : (
          <p className="ui-chart-empty">{emptyText}</p>
        )}
      </div>
    </ChartFrame>
  );
}
