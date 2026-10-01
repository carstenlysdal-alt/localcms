import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/** Læs JSON-body med hård størrelsesgrænse (virker også for sendBeacon, som kan have text/plain). */
export async function readJsonBody(req: Request, maxBytes: number): Promise<{ ok: true; data: unknown } | { ok: false; status: 400 | 413; error: string }> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { ok: false, status: 413, error: "Forespørgslen er for stor." };
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { ok: false, status: 400, error: "Ugyldig forespørgsel." };
  }
  if (Buffer.byteLength(text) > maxBytes) return { ok: false, status: 413, error: "Forespørgslen er for stor." };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "Ugyldig JSON." };
  }
}

export async function parseJson<T>(req: Request, schema: ZodType<T>, maxBytes: number): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const body = await readJsonBody(req, maxBytes);
  if (!body.ok) return { ok: false, response: NextResponse.json({ error: body.error }, { status: body.status }) };
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Validering fejlede.", issues: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Same-origin-tjek til anonyme POST-endpoints (tracking). Browsere sender Origin/Sec-Fetch-Site på
 * POST; scripts (curl) kan forfalske dem, så dette er kun et første filter — rate limit og dedupe er
 * det egentlige forsvar.
 */
export function isSameOrigin(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

// ── Forespørgselshygiejne ────────────────────────────────────────────────────

/** Standardloft for offentlige POST-forespørgsler (formularer, tracking). Redaktionens uploads er undtaget (kræver session). */
export const PUBLIC_BODY_MAX_BYTES = 1024 * 1024;

/** true hvis den angivne Content-Length overstiger grænsen (hurtigt filter før body læses). Mangler headeren: false. */
export function declaredBodyTooLarge(headers: Pick<Headers, "get">, maxBytes: number): boolean {
  const raw = headers.get("content-length");
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > maxBytes;
}

/** 413-svar til brug i route handlers: `const tooBig = rejectOversize(req, 16 * 1024); if (tooBig) return tooBig;` */
export function rejectOversize(req: Request, maxBytes: number): NextResponse | null {
  if (declaredBodyTooLarge(req.headers, maxBytes)) {
    return NextResponse.json({ error: "Forespørgslen er for stor." }, { status: 413, headers: { "Cache-Control": "no-store" } });
  }
  return null;
}

export class FetchTimeoutError extends Error {
  constructor(url: string, ms: number) {
    super(`Kald til ${safeHost(url)} overskred ${ms} ms.`);
    this.name = "FetchTimeoutError";
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "ukendt vært";
  }
}

/**
 * fetch med hård timeout (standard 5 s) via AbortController. Brug til ALLE udgående kald, så en langsom tredjepart
 * aldrig kan binde serverens forbindelser. Respekterer et eventuelt signal fra kalderen.
 */
export async function fetchWithTimeout(input: string | URL, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 5000, signal: outer, ...rest } = init;
  const controller = new AbortController();
  const onAbort = () => controller.abort(outer?.reason);
  if (outer) {
    if (outer.aborted) controller.abort(outer.reason);
    else outer.addEventListener("abort", onAbort, { once: true });
  }
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new FetchTimeoutError(String(input), timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onAbort);
  }
}
