"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { ChartFrame, ChartLegend } from "./ChartFrame";
import { ChartTip } from "./ChartTip";
import { SERIES_CLASS, formatValue, niceScale, useElementWidth } from "./chart-utils";

export type BarSeries = { id: string; label: string; values: number[] };

export type BarsProps = {
  title: string;
  description?: string;
  categories: string[];
  series: BarSeries[];
  /** `grouped` = søjler ved siden af hinanden · `stacked` = oven på hinanden. */
  mode?: "grouped" | "stacked";
  /** `horizontal` giver plads til lange kategorinavne. */
  orientation?: "vertical" | "horizontal";
  valueKind?: "number" | "percent" | "compact";
  emptyText?: string;
  className?: string;
};

const BAR_H = 26;

/** Søjlediagram (grupperet/stablet, lodret/vandret) i ren SVG, med tastatur (pile) og tabel-fallback. */
export function Bars({ title, description, categories, series, mode = "grouped", orientation = "vertical", valueKind = "number", emptyText = "Ingen data i perioden.", className }: BarsProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = categories.length;
  const totals = categories.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const maxVal = mode === "stacked" ? Math.max(0, ...totals) : Math.max(0, ...series.flatMap((s) => s.values));
  const hasData = n > 0 && maxVal > 0;
  const { max, ticks } = niceScale(maxVal);
  const horizontal = orientation === "horizontal";

  // Geometri
  const labelW = horizontal ? Math.min(150, Math.max(90, Math.round(width * 0.3))) : 0;
  const M = horizontal ? { top: 8, right: 16, bottom: 26, left: labelW } : { top: 12, right: 12, bottom: 44, left: 44 };
  const rowH = horizontal ? Math.max(BAR_H, mode === "grouped" ? series.length * 16 + 10 : BAR_H) : 0;
  const height = horizontal ? M.top + M.bottom + n * (rowH + 8) : 260;
  const innerW = Math.max(10, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;

  const valToLen = (v: number) => (v / max) * (horizontal ? innerW : innerH);
  const slot = horizontal ? (rowH + 8) : innerW / Math.max(1, n);

  function indexFromPointer(e: PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = horizontal ? height / rect.height : width / rect.width;
    const pos = horizontal ? (e.clientY - rect.top) * scale - M.top : (e.clientX - rect.left) * scale - M.left;
    return Math.min(n - 1, Math.max(0, Math.floor(pos / slot)));
  }

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    if (!n) return;
    const next = horizontal ? "ArrowDown" : "ArrowRight";
    const prev = horizontal ? "ArrowUp" : "ArrowLeft";
    if (e.key === next) { e.preventDefault(); setActive((i) => (i === null ? 0 : Math.min(n - 1, i + 1))); }
    else if (e.key === prev) { e.preventDefault(); setActive((i) => (i === null ? n - 1 : Math.max(0, i - 1))); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(n - 1); }
    else if (e.key === "Escape") setActive(null);
  }

  const liveText = active !== null
    ? `${categories[active]}: ${series.map((s) => `${s.label} ${formatValue(s.values[active] ?? 0, valueKind)}`).join(", ")}${mode === "stacked" && series.length > 1 ? `, i alt ${formatValue(totals[active], valueKind)}` : ""}`
    : "";
  const summary = hasData ? `${title}. ${n} kategorier. Størst: ${categories[totals.indexOf(Math.max(...totals))]}. Brug piletaster til at gennemgå.` : `${title}. ${emptyText}`;
  const table = {
    caption: title,
    headers: ["Kategori", ...series.map((s) => s.label), ...(series.length > 1 ? ["I alt"] : [])],
    rows: categories.map((c, i) => [c, ...series.map((s) => formatValue(s.values[i] ?? 0, valueKind)), ...(series.length > 1 ? [formatValue(totals[i], valueKind)] : [])]),
  };

  function bars(ci: number) {
    const els: React.ReactNode[] = [];
    let offset = 0;
    series.forEach((s, si) => {
      const v = s.values[ci] ?? 0;
      const len = valToLen(v);
      if (horizontal) {
        const base = M.top + ci * slot;
        if (mode === "stacked") {
          els.push(<rect key={s.id} x={M.left + offset} y={base} width={Math.max(0, len)} height={rowH} className={`ui-chart-bar ${SERIES_CLASS(si)}`} />);
          offset += len;
        } else {
          const h = (rowH - (series.length - 1) * 2) / series.length;
          els.push(<rect key={s.id} x={M.left} y={base + si * (h + 2)} width={Math.max(0, len)} height={h} rx={3} className={`ui-chart-bar ${SERIES_CLASS(si)}`} />);
        }
      } else {
        const groupX = M.left + ci * slot;
        const pad = Math.min(14, slot * 0.2);
        const groupW = slot - pad * 2;
        if (mode === "stacked") {
          els.push(<rect key={s.id} x={groupX + pad} y={M.top + innerH - offset - len} width={Math.max(2, groupW)} height={Math.max(0, len)} className={`ui-chart-bar ${SERIES_CLASS(si)}`} />);
          offset += len;
        } else {
          const w = groupW / series.length;
          els.push(<rect key={s.id} x={groupX + pad + si * w} y={M.top + innerH - len} width={Math.max(2, w - 2)} height={Math.max(0, len)} rx={3} className={`ui-chart-bar ${SERIES_CLASS(si)}`} />);
        }
      }
    });
    return els;
  }

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
            {ticks.map((t) => horizontal ? (
              <g key={t}>
                <line className="ui-chart-grid" x1={M.left + valToLen(t)} x2={M.left + valToLen(t)} y1={M.top} y2={M.top + innerH} />
                <text className="ui-chart-text" x={M.left + valToLen(t)} y={height - 8} textAnchor="middle">{formatValue(t, valueKind === "percent" ? "percent" : "compact")}</text>
              </g>
            ) : (
              <g key={t}>
                <line className="ui-chart-grid" x1={M.left} x2={width - M.right} y1={M.top + innerH - valToLen(t)} y2={M.top + innerH - valToLen(t)} />
                <text className="ui-chart-text" x={M.left - 8} y={M.top + innerH - valToLen(t)} textAnchor="end" dominantBaseline="middle">{formatValue(t, valueKind === "percent" ? "percent" : "compact")}</text>
              </g>
            ))}
            {categories.map((c, ci) => (
              <g key={c + ci}>
                {active === ci ? (horizontal
                  ? <rect className="ui-chart-hl" x={0} y={M.top + ci * slot - 3} width={width} height={rowH + 6} />
                  : <rect className="ui-chart-hl" x={M.left + ci * slot} y={M.top} width={slot} height={innerH} />) : null}
                {bars(ci)}
                {horizontal ? (
                  <text className="ui-chart-text" x={M.left - 8} y={M.top + ci * slot + rowH / 2} textAnchor="end" dominantBaseline="middle">{c.length > 22 ? `${c.slice(0, 21)}…` : c}</text>
                ) : (
                  <text className="ui-chart-text" x={M.left + ci * slot + slot / 2} y={height - 24} textAnchor="middle">{c.length > Math.max(6, Math.floor(slot / 7)) ? `${c.slice(0, Math.max(5, Math.floor(slot / 7) - 1))}…` : c}</text>
                )}
              </g>
            ))}
            {active !== null ? (
              <ChartTip
                x={horizontal ? M.left + valToLen(totals[active]) / 2 + 40 : M.left + active * slot + slot / 2}
                y={horizontal ? M.top + active * slot + rowH + 8 : M.top}
                maxX={width}
                title={categories[active]}
                lines={[...series.map((s) => `${s.label}: ${formatValue(s.values[active] ?? 0, valueKind)}`), ...(mode === "stacked" && series.length > 1 ? [`I alt: ${formatValue(totals[active], valueKind)}`] : [])]}
              />
            ) : null}
          </svg>
        ) : (
          <p className="ui-chart-empty">{emptyText}</p>
        )}
      </div>
    </ChartFrame>
  );
}
