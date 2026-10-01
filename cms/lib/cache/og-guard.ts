import { getClientIp } from "../client-ip";
import { classifyUserAgent, tightenLimit } from "../bot/detect";
import { rateLimit } from "../ratelimit";

/**
 * Beskyttelse af /og/* (billedgenerering = CPU-dyrt: satori + sharp).
 *  - strenge parametre: kun ?f=<format> og ?v=<version> accepteres; alt andet (fx tilfældige ?x=1…n, der ville
 *    omgå CDN-cachen og tvinge nyt arbejde hver gang) giver 404
 *  - slug-allowlist; ukendt format -> 404 (ingen stille fallback, som ville give uendeligt mange cache-nøgler)
 *  - pr.-IP-grænse (strammere for skrabere/tom UA) og proces-lokal samtidighedsbegrænsning (semafor, standard 4)
 *  - uforanderlig CDN-cache (1 år) når ?v= er med; ellers kort/medium cache
 */

export const OG_FORMAT_KEYS = ["16x9", "4x3", "1x1"] as const;
export type OgFormatParam = (typeof OG_FORMAT_KEYS)[number];

// Bogstaver/tal/æøå + evt. percent-kodede tegn (aldrig %00, %2e, %2f); bindestreger kun mellem dele.
const SLUG_PART = "(?:[a-z0-9æøå]|%(?!00|2e|2f)[0-9a-f]{2})+";
const SLUG = new RegExp(`^${SLUG_PART}(?:-${SLUG_PART})*$`, "i");
const VERSION = /^[A-Za-z0-9._-]{1,32}$/;
const ALLOWED_PARAMS = new Set(["f", "v"]);

export type OgParams = { slug: string | null; format: "og" | OgFormatParam; version: string | null };

/** Returnerer null hvis noget er ugyldigt (-> 404). `file` er det dynamiske segment, fx "min-historie.jpg". */
export function parseOgRequest(file: string | null, search: URLSearchParams): OgParams | null {
  for (const key of search.keys()) if (!ALLOWED_PARAMS.has(key)) return null;
  if (search.getAll("f").length > 1 || search.getAll("v").length > 1) return null;

  let format: OgParams["format"] = "og";
  const f = search.get("f");
  if (f !== null) {
    if (!(OG_FORMAT_KEYS as readonly string[]).includes(f)) return null;
    format = f as OgFormatParam;
  }
  let version: string | null = null;
  const v = search.get("v");
  if (v !== null) {
    if (!VERSION.test(v)) return null;
    version = v;
  }
  if (file === null) return { slug: null, format, version };

  const m = /^(.{1,200}?)\.(jpe?g|png)$/i.exec(file);
  const slug = m ? m[1] : null;
  if (!slug || slug.length > 160 || !SLUG.test(slug)) return null;
  return { slug, format, version };
}

export const OG_IMMUTABLE_CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";
export const OG_SHORT_CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export function ogCacheControl(version: string | null): string {
  return version ? OG_IMMUTABLE_CACHE : OG_SHORT_CACHE;
}

// ── Samtidighed ─────────────────────────────────────────────────────────────

export class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  constructor(
    private readonly max: number,
    private readonly maxQueue: number,
  ) {}

  /** Returnerer en release-funktion, eller null hvis køen er fuld (-> 503). */
  async acquire(): Promise<(() => void) | null> {
    if (this.active < this.max) {
      this.active++;
      return this.release();
    }
    if (this.queue.length >= this.maxQueue) return null;
    await new Promise<void>((resolve) => this.queue.push(resolve));
    return this.release();
  }

  private release(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.queue.shift();
      if (next) next(); // giver pladsen videre (active uændret)
      else this.active--;
    };
  }

  stats() {
    return { active: this.active, queued: this.queue.length };
  }
}

const g = globalThis as unknown as { __ogSemaphore?: Semaphore };
export function ogSemaphore(): Semaphore {
  const max = Math.max(1, Number.parseInt(process.env.OG_CONCURRENCY ?? "", 10) || 4);
  return (g.__ogSemaphore ??= new Semaphore(max, max * 4));
}

function plain(status: number, extra: Record<string, string> = {}): Response {
  return new Response(status === 404 ? "Not found" : status === 429 ? "Too many requests" : "Service unavailable", {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": status === 404 ? "public, max-age=60, s-maxage=300" : "no-store", ...extra },
  });
}

export function ogNotFound(): Response {
  return plain(404);
}

/**
 * Kør en billedgenerering bag IP-grænse og semafor. Returnerer svaret eller et 429/503.
 * `render` må selv returnere 404.
 */
export async function guardedOgRender(request: Request, render: () => Promise<Response>): Promise<Response> {
  const ip = getClientIp(request.headers);
  const kind = classifyUserAgent(request.headers.get("user-agent")).kind;
  const limit = await rateLimit({ bucket: "og", key: ip, limit: tightenLimit(60, kind), windowMs: 60_000 });
  if (!limit.ok) return plain(429, { "Retry-After": String(limit.retryAfterSec) });

  const release = await ogSemaphore().acquire();
  if (!release) return plain(503, { "Retry-After": "5" });
  try {
    return await render();
  } finally {
    release();
  }
}
