"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export type ChartTable = { caption: string; headers: string[]; rows: Array<Array<string | number>> };

/**
 * Fælles ramme om et diagram: titel (overskrift), beskrivelse, legend, selve diagrammet, live-region til tooltip-tekst
 * og en tabel-fallback (<details>) med de samme data — tastatur- og skærmlæservenlig.
 */
export function ChartFrame({ title, description, legend, children, table, live, className, headingLevel = 3 }: {
  title: string;
  description?: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  table: ChartTable;
  /** Tekst der annonceres (aria-live) når brugeren flytter markøren. */
  live?: string;
  className?: string;
  headingLevel?: 2 | 3 | 4;
}) {
  const uid = useId();
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  return (
    <figure className={cn("ui-chart", className)} aria-labelledby={`${uid}-title`}>
      <figcaption className="ui-chart-head">
        <Heading id={`${uid}-title`} className="ui-chart-title">{title}</Heading>
        {description ? <p className="ui-chart-desc">{description}</p> : null}
        {legend}
      </figcaption>
      <div className="ui-chart-body">{children}</div>
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{live ?? ""}</p>
      <details className="ui-chart-table">
        <summary>Vis data som tabel</summary>
        <div className="ui-table-scroll">
          <table className="ui-table">
            <caption className="sr-only">{table.caption}</caption>
            <thead><tr>{table.headers.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function ChartLegend({ items }: { items: Array<{ id: string; label: string; swatch: string }> }) {
  return (
    <ul className="ui-chart-legend" aria-label="Forklaring">
      {items.map((item) => (
        <li key={item.id}><span className={cn("ui-chart-swatch", item.swatch)} aria-hidden="true" />{item.label}</li>
      ))}
    </ul>
  );
}
