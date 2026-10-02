/**
 * Rene hjælpere til analytics-siden (ingen DB, ingen React): periode, delta, dags-serier, varmekort.
 * Alle tal der vises kommer fra rigtige rækker; hvad der ikke kan beregnes giver `null` (aldrig 0 som lyvende tal).
 */

export const RANGES = [7, 28, 90] as const;
export type Range = (typeof RANGES)[number];

export function parseRange(value: unknown): Range {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 28;
}

const DAY_MS = 86_400_000;

/** Dagsnøgle YYYY-MM-DD i UTC (samme format som FrontpageSlotMetric.day). */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type Period = { start: Date; end: Date; prevStart: Date; days: number };

/** Nuværende periode = de seneste `days` døgn (inkl. i dag); forrige periode = de `days` døgn før. */
export function periodBounds(now: Date, days: number): Period {
  const end = new Date(now);
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(startOfToday.getTime() - (days - 1) * DAY_MS);
  const prevStart = new Date(start.getTime() - days * DAY_MS);
  return { start, end, prevStart, days };
}

/** Alle dagsnøgler i perioden, ældst først. */
export function periodDays(period: Period): string[] {
  const keys: string[] = [];
  for (let i = 0; i < period.days; i++) keys.push(dayKey(new Date(period.start.getTime() + i * DAY_MS)));
  return keys;
}

export function inRange(date: Date, from: Date, to: Date | null = null): boolean {
  return date.getTime() >= from.getTime() && (to === null || date.getTime() < to.getTime());
}

/** Procentvis ændring mod forrige periode. `null` når der ikke findes noget at sammenligne med (forrige = 0). */
export function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export type MetricInput = { visninger: number; laesninger: number; totalLaesetidSek: number };

export function sumMetrics(items: MetricInput[]): MetricInput {
  return items.reduce((acc, m) => ({ visninger: acc.visninger + m.visninger, laesninger: acc.laesninger + m.laesninger, totalLaesetidSek: acc.totalLaesetidSek + m.totalLaesetidSek }), { visninger: 0, laesninger: 0, totalLaesetidSek: 0 });
}

/** Gennemsnitlig læsetid i sekunder pr. læsning (null uden læsninger). */
export function avgReadSeconds(m: MetricInput): number | null {
  return m.laesninger > 0 ? Math.round(m.totalLaesetidSek / m.laesninger) : null;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "–";
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

/** Lægger rækker sammen pr. dag. Dage uden rækker får 0 (ægte nul: der var ingen hændelser den dag). */
export function bucketByDay<T>(rows: T[], days: string[], dayOf: (row: T) => string, valueOf: (row: T) => number): number[] {
  const index = new Map(days.map((d, i) => [d, i]));
  const out = days.map(() => 0);
  for (const row of rows) {
    const i = index.get(dayOf(row));
    if (i !== undefined) out[i] += valueOf(row);
  }
  return out;
}

/** "12. okt." til akseetiketter. */
export function shortDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;
export const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", weekday: "short", timeZone: "Europe/Copenhagen" });
const WD_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Ugedag (man=0) × time (0–23) i dansk tid for en liste af tidspunkter. */
export function weekdayHourMatrix(dates: Date[]): number[][] {
  const grid = WEEKDAYS.map(() => HOURS.map(() => 0));
  for (const d of dates) {
    const parts = hourFmt.formatToParts(d);
    const wd = WD_INDEX[parts.find((p) => p.type === "weekday")?.value ?? ""];
    const hr = Number(parts.find((p) => p.type === "hour")?.value);
    if (wd !== undefined && Number.isInteger(hr)) grid[wd][hr] += 1;
  }
  return grid;
}

/** Tæller pr. nøgle, sorteret faldende. */
export function countBy<T>(rows: T[], keyOf: (row: T) => string): Array<{ key: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of rows) map.set(keyOf(r), (map.get(keyOf(r)) ?? 0) + 1);
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, "da"));
}
