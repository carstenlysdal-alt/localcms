import { z } from "zod";
import { getAuthorizedUser } from "@/lib/auth";
import { rateLimit, rateLimitHeaders, getClientIp } from "@/lib/ratelimit";
import { isSameOrigin, readJsonBody } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { applyUndo } from "@/lib/operator/dispatch";
import { RATE_LIMIT_CONFIRM } from "@/lib/operator/policy";
import { getToolDeps } from "@/lib/operator/runtime";

/** POST /api/operator/undo  { undoId } — Fortryd-knappen. Kun ejeren af handlingen, højst én gang, inden for 24 timer. */
const bodySchema = z.object({ undoId: z.string().regex(/^[A-Za-z0-9_-]{6,40}$/) });

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ ok: false, message: "Ugyldig oprindelse." }, 403);
  if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) return json({ ok: false, message: "Forventer application/json." }, 415);
  const user = await getAuthorizedUser(PERMISSIONS.OPERATOR_USE);
  if (!user) return json({ ok: false, message: "Ikke autoriseret." }, 401);
  const limited = await rateLimit({ ...RATE_LIMIT_CONFIRM, bucket: "operator-undo", key: user.id, failMode: "closed" });
  if (!limited.ok) return json({ ok: false, message: "For mange forsøg. Vent lidt." }, 429, rateLimitHeaders(limited));
  const raw = await readJsonBody(req, 1024);
  if (!raw.ok) return json({ ok: false, message: raw.error }, raw.status);
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return json({ ok: false, message: "Ugyldig forespørgsel." }, 400);
  const res = await applyUndo({ user, instansId: user.instansId, now: new Date(), sessionId: null, ip: getClientIp(req.headers), deps: getToolDeps() }, parsed.data.undoId);
  return json(res, res.ok ? 200 : 409);
}
