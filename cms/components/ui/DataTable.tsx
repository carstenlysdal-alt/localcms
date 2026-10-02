"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "./cn";
import { EmptyState } from "./EmptyState";
import { SkeletonRows } from "./Skeleton";
import { Notice } from "./Layout";

export type DataTableColumn = {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  /** Skjul kolonnen på små skærme (< 640 px) — rækkens øvrige data bevares. */
  hideOnMobile?: boolean;
  /** Skjul header visuelt (handlingskolonner), men bevar den for skærmlæsere. */
  srOnlyHeader?: boolean;
};

export type DataTableRow = {
  id: string;
  /** Cellernes indhold pr. kolonne-key (kan være serverkomponenter). */
  cells: Record<string, ReactNode>;
  /** Værdier der sorteres på (ellers bruges cellens tekst hvis den er en streng/et tal). */
  sort?: Record<string, string | number | null | undefined>;
};

export type DataTableProps = {
  /** Tabellens navn (vises som skjult caption — påkrævet for tilgængelighed). */
  caption: string;
  columns: DataTableColumn[];
  rows: DataTableRow[];
  state?: "ready" | "loading" | "error";
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  errorMessage?: string;
  /** Start-sortering. */
  defaultSort?: { key: string; direction: "asc" | "desc" };
  className?: string;
};

type Sort = { key: string; direction: "asc" | "desc" } | null;

function sortValue(row: DataTableRow, key: string): string | number {
  const explicit = row.sort?.[key];
  if (explicit !== undefined && explicit !== null) return explicit;
  const cell = row.cells[key];
  if (typeof cell === "string" || typeof cell === "number") return cell;
  return "";
}

/**
 * Tabel med sortering (knap i headeren, `aria-sort`), tom-/loading-/fejltilstand og vandret scroll inde i sit eget område.
 * Data-baseret (rows/cells) så den kan fodres fra serverkomponenter. Sortering er stabil og sprogfølsom (da-DK, tal som tal).
 */
export function DataTable({ caption, columns, rows, state = "ready", emptyTitle = "Ingen data", emptyDescription, emptyAction, errorMessage, defaultSort, className }: DataTableProps) {
  const [sort, setSort] = useState<Sort>(defaultSort ?? null);
  const collator = useMemo(() => new Intl.Collator("da-DK", { numeric: true, sensitivity: "base" }), []);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return collator.compare(String(x), String(y)) * dir;
    });
  }, [rows, sort, collator]);

  function toggle(key: string) {
    setSort((cur) => (cur?.key === key ? (cur.direction === "asc" ? { key, direction: "desc" } : null) : { key, direction: "asc" }));
  }

  if (state === "loading") return <div className={cn("ui-table-state", className)}><SkeletonRows rows={5} /></div>;
  if (state === "error") return <div className={cn("ui-table-state", className)}><Notice tone="danger" title="Kunne ikke hente data">{errorMessage ?? "Prøv at genindlæse siden."}</Notice></div>;
  if (rows.length === 0) return <EmptyState variant="inline" title={emptyTitle} description={emptyDescription} action={emptyAction} className={className} />;

  return (
    <div className={cn("ui-table-scroll", className)} role="region" aria-label={`${caption} (kan rulles vandret)`} tabIndex={0}>
      <table className="ui-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sort?.key === col.key ? sort.direction : null;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={col.sortable ? (active === "asc" ? "ascending" : active === "desc" ? "descending" : "none") : undefined}
                  className={cn(col.align && `ui-align-${col.align}`, col.hideOnMobile && "ui-hide-mobile")}
                >
                  {col.sortable ? (
                    <button type="button" className="ui-sort" onClick={() => toggle(col.key)}>
                      {col.header}
                      {active === "asc" ? <ArrowUp size={14} aria-hidden="true" /> : active === "desc" ? <ArrowDown size={14} aria-hidden="true" /> : <ChevronsUpDown size={14} aria-hidden="true" />}
                    </button>
                  ) : col.srOnlyHeader ? (
                    <span className="sr-only">{col.header}</span>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => (
                <td key={col.key} className={cn(col.align && `ui-align-${col.align}`, col.hideOnMobile && "ui-hide-mobile")}>
                  {row.cells[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
