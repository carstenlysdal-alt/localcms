"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** "Pæne" akse-ticks: 0 … max med 4–5 trin i 1/2/5 × 10ⁿ. */
export function niceScale(rawMax: number, targetTicks = 4): { max: number; ticks: number[] } {
  if (!Number.isFinite(rawMax) || rawMax <= 0) return { max: 1, ticks: [0, 1] };
  const rough = rawMax / targetTicks;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / pow;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow;
  const max = Math.ceil(rawMax / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { max, ticks };
}

const nf = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });
const nfCompact = new Intl.NumberFormat("da-DK", { notation: "compact", maximumFractionDigits: 1 });

export function formatValue(value: number, kind: "number" | "percent" | "compact" = "number"): string {
  if (kind === "percent") return `${nf.format(value)} %`;
  if (kind === "compact") return nfCompact.format(value);
  return nf.format(value);
}

/** Måler et elements bredde (ResizeObserver). Giver `initial` under SSR og første render, så markup er stabilt. */
export function useElementWidth<T extends HTMLElement>(initial = 640): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setWidth(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Farve til serie nr. i (1–6, derefter forfra). Returnerer CSS-variabel — aldrig hex. */
export function seriesColor(index: number): string {
  return `var(--cms-chart-${(index % 6) + 1})`;
}

export const SERIES_CLASS = (index: number) => `ui-chart-s${(index % 6) + 1}`;
