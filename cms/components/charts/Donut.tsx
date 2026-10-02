"use client";

import { useState } from "react";
import { ChartFrame } from "./ChartFrame";
import { SERIES_CLASS, formatValue, useElementWidth } from "./chart-utils";

export type DonutSlice = { id: string; label: string; value: number };

export type DonutProps = {
  title: string;
  description?: string;
  slices: DonutSlice[];
  /** Tekst under totalen i midten (fx "artikler"). */
  centerLabel?: string;
  emptyText?: string;
  className?: string;
};

/** Donut i ren SVG med forklaring (liste med værdi og andel) — farve er aldrig eneste bærer af information. */
export function Donut({ title, description, slices, centerLabel = "i alt", emptyText = "Ingen data i perioden.", className }: DonutProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>(260);
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const size = Math.min(220, Math.max(160, width));
  const r = size / 2 - 14;
  const stroke = Math.max(22, size * 0.14);
  const c = 2 * Math.PI * r;

  const arcs = slices.map((s, i) => {
    const before = slices.slice(0, i).reduce((sum, x) => sum + x.value, 0);
    const dash = total > 0 ? (s.value / total) * c : 0;
    return { slice: s, index: i, dash, offset: -(before / (total || 1)) * c };
  });

  const table = {
    caption: title,
    headers: ["Kategori", "Antal", "Andel"],
    rows: slices.map((s) => [s.label, formatValue(s.value), total > 0 ? formatValue((s.value / total) * 100, "percent") : "–"]),
  };

  return (
    <ChartFrame title={title} description={description} className={className} table={table} live={hover ? (() => { const s = slices.find((x) => x.id === hover); return s ? `${s.label}: ${formatValue(s.value)} (${formatValue(total > 0 ? (s.value / total) * 100 : 0, "percent")})` : ""; })() : ""}>
      {total > 0 ? (
        <div ref={ref} className="ui-donut">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title}. ${slices.map((s) => `${s.label} ${formatValue(s.value)}`).join(", ")}.`} className="ui-donut-svg">
            <title>{title}</title>
            <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ui-donut-track" />
              {arcs.map(({ slice, index, dash, offset }) => (dash > 0 ? (
                <circle
                  key={slice.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  strokeWidth={hover === slice.id ? stroke + 4 : stroke}
                  strokeDasharray={`${Math.max(0, dash - (slices.length > 1 ? 1.5 : 0))} ${c}`}
                  strokeDashoffset={offset}
                  className={`ui-donut-arc ${SERIES_CLASS(index)}`}
                  onPointerEnter={() => setHover(slice.id)}
                  onPointerLeave={() => setHover(null)}
                />
              ) : null))}
            </g>
            <text x={size / 2} y={size / 2 - 2} textAnchor="middle" className="ui-donut-total">{formatValue(total)}</text>
            <text x={size / 2} y={size / 2 + 18} textAnchor="middle" className="ui-chart-text">{centerLabel}</text>
          </svg>
          <ul className="ui-donut-legend" aria-label="Forklaring">
            {slices.map((s, i) => (
              <li key={s.id} data-active={hover === s.id ? "true" : undefined} onPointerEnter={() => setHover(s.id)} onPointerLeave={() => setHover(null)}>
                <span className={`ui-chart-swatch ui-swatch-s${(i % 6) + 1}`} aria-hidden="true" />
                <span className="ui-donut-label">{s.label}</span>
                <span className="ui-donut-value">{formatValue(s.value)} <span className="ui-muted">({formatValue((s.value / total) * 100, "percent")})</span></span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="ui-chart-empty">{emptyText}</p>
      )}
    </ChartFrame>
  );
}
