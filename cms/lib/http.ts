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
