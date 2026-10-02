"use client";

import { useState, type KeyboardEvent } from "react";
import { ChartFrame } from "./ChartFrame";
import { ChartTip } from "./ChartTip";
import { formatValue, useElementWidth } from "./chart-utils";

export type HeatmapProps = {
  title: string;
  description?: string;
  /** Rækker (fx ugedage). */
  rows: string[];
  /** Kolonner (fx timer). */
  cols: string[];
  /** values[rækkeindeks][kolonneindeks] */
  values: number[][];
  /** Ordet for en enhed i tooltip/tabel, fx "artikler". */
  unit?: string;
  emptyText?: string;
  className?: string;
};

const LABEL_W = 44;

/** Varmekort (række × kolonne) i ren SVG. 6 farvetrin (sekventiel indigo), piletaster flytter celle, tabel-fallback. */
export function Heatmap({ title, description, rows, cols, values, unit = "", emptyText = "Ingen data i perioden.", className }: HeatmapProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<[number, number] | null>(null);
  const max = Math.max(0, ...values.flat());
  const hasData = max > 0;
  const cell = Math.max(10, Math.floor((width - LABEL_W - 4) / Math.max(1, cols.length)));
  const gap = 2;
  const rowH = Math.max(20, Math.min(30, cell));
  const height = rows.length * rowH + 28;
  const level = (v: number) => (v <= 0 ? 0 : Math.min(5, 1 + Math.floor((v / max) * 4.999)));
  const colEvery = Math.max(1, Math.ceil(28 / cell * (cols.length > 12 ? 1.4 : 1)));

  function onKeyDown(e: KeyboardEvent<SVGSVGElement>) {
    const [r, c] = active ?? [0, -1];
    let next: [number, number] | null = null;
    if (e.key === "ArrowRight") next = [r, Math.min(cols.length - 1, c + 1)];
    else if (e.key === "ArrowLeft") next = [r, Math.max(0, c - 1)];
    else if (e.key === "ArrowDown") next = [Math.min(rows.length - 1, active ? r + 1 : 0), Math.max(0, c)];
    else if (e.key === "ArrowUp") next = [Math.max(0, r - 1), Math.max(0, c)];
    else if (e.key === "Home") next = [r, 0];
    else if (e.key === "End") next = [r, cols.length - 1];
    else if (e.key === "Escape") { setActive(null); return; }
    if (next) { e.preventDefault(); setActive(next); }
  }

  const cellText = (r: number, c: number) => `${rows[r]} ${cols[c]}: ${formatValue(values[r]?.[c] ?? 0)}${unit ? ` ${unit}` : ""}`;
  const table = {
    caption: title,
    headers: ["", ...cols],
    rows: rows.map((r, ri) => [r, ...cols.map((_, ci) => formatValue(values[ri]?.[ci] ?? 0))]),
  };

  return (
    <ChartFrame
      title={title}
      description={description}
      className={className}
      table={table}
      live={active ? cellText(active[0], active[1]) : ""}
      legend={hasData ? (
        <p className="ui-heat-legend" aria-hidden="true">
          Færre <span className="ui-heat-scale">{[0, 1, 2, 3, 4, 5].map((l) => <span key={l} className={`ui-heat-step ui-heat-${l}`} />)}</span> Flere
        </p>
      ) : undefined}
    >
      <div ref={ref} className="ui-chart-canvas">
        {hasData ? (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="group"
            aria-label={`${title}. ${rows.length} rækker, ${cols.length} kolonner. Brug piletaster til at gennemgå cellerne.`}
            tabIndex={0}
            className="ui-chart-svg"
            onKeyDown={onKeyDown}
            onBlur={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
          >
            <title>{title}</title>
            {rows.map((r, ri) => (
              <g key={r}>
                <text className="ui-chart-text" x={LABEL_W - 8} y={ri * rowH + rowH / 2} textAnchor="end" dominantBaseline="middle">{r}</text>
                {cols.map((c, ci) => (
                  <rect
                    key={c}
                    x={LABEL_W + ci * cell}
                    y={ri * rowH}
                    width={cell - gap}
                    height={rowH - gap}
                    rx={3}
                    className={`ui-heat-cell ui-heat-${level(values[ri]?.[ci] ?? 0)}${active && active[0] === ri && active[1] === ci ? " is-active" : ""}`}
                    onPointerEnter={() => setActive([ri, ci])}
                  />
                ))}
              </g>
            ))}
            {cols.map((c, ci) => (ci % colEvery === 0 ? <text key={c} className="ui-chart-text" x={LABEL_W + ci * cell + (cell - gap) / 2} y={rows.length * rowH + 16} textAnchor="middle">{c}</text> : null))}
            {active ? <ChartTip x={LABEL_W + active[1] * cell + cell / 2} y={Math.max(0, active[0] * rowH - 46)} maxX={width} width={150} title={`${rows[active[0]]} ${cols[active[1]]}`} lines={[`${formatValue(values[active[0]]?.[active[1]] ?? 0)}${unit ? ` ${unit}` : ""}`]} /> : null}
          </svg>
        ) : (
          <p className="ui-chart-empty">{emptyText}</p>
        )}
      </div>
    </ChartFrame>
  );
}
