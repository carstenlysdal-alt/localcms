/** Små, rene formateringshjælpere til editoren (testbare; ingen DOM). Tidszone: Europe/Copenhagen. */

const TZ = "Europe/Copenhagen";

function ymd(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function hm(d: Date): string {
  return new Intl.DateTimeFormat("da-DK", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).replace(".", ":");
}

/** "i dag 10:24", "i går 22:05" eller "3. okt. 10:24". */
export function formatSavedAt(saved: Date, now: Date = new Date()): string {
  const day = ymd(saved);
  if (day === ymd(now)) return `i dag ${hm(saved)}`;
  if (day === ymd(new Date(now.getTime() - 24 * 3600 * 1000))) return `i går ${hm(saved)}`;
  const date = new Intl.DateTimeFormat("da-DK", { timeZone: TZ, day: "numeric", month: "short" }).format(saved);
  return `${date} ${hm(saved)}`;
}

/** ISO (UTC) -> værdi til <input type="datetime-local"> i dansk tid ("2026-10-03T07:30"). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** Værdi fra <input type="datetime-local"> (dansk tid) -> ISO (UTC). Tom/ugyldig -> "". */
export function fromLocalInput(value: string): string {
  if (!value) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return "";
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  // Find UTC-tidspunktet hvis visning i Europe/Copenhagen skal give den ønskede lokale tid (2 forsøg dækker sommertid).
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const shown = toLocalInput(new Date(guess).toISOString());
    const sm = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(shown);
    if (!sm) break;
    const [sy, smo, sd, sh, smi] = sm.slice(1).map(Number);
    const diff = Date.UTC(y, mo - 1, d, h, mi) - Date.UTC(sy, smo - 1, sd, sh, smi);
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess).toISOString();
}

/** Tegntæller "42/110" og om grænsen er overskredet. */
export function charCount(text: string, max: number): { label: string; over: boolean; near: boolean } {
  const n = Array.from(text).length;
  return { label: `${n}/${max}`, over: n > max, near: n > max * 0.9 && n <= max };
}
