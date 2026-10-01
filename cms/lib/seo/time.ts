/** ISO 8601 med dansk tidszone-offset, fx `2026-10-01T05:39:33+02:00`. */
export function isoWithOffset(input: Date | string | number | null | undefined): string | undefined {
  if (input === null || input === undefined) return undefined;
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return undefined;
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Copenhagen",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const localAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const realSec = Math.floor(d.getTime() / 1000) * 1000;
  const offsetMin = Math.round((localAsUtc - realSec) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${get("year")}-${pad(get("month"))}-${pad(get("day"))}` +
    `T${pad(get("hour"))}:${pad(get("minute"))}:${pad(get("second"))}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
