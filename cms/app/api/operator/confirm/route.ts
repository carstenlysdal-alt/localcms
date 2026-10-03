import { z } from "zod";
import { getAuthorizedUser } from "@/lib/auth";
import { rateLimit, rateLimitHeaders, getClientIp } from "@/lib/ratelimit";
import { isSameOrigin, readJsonBody } from "@/lib/http";
import { PERMISSIONS } from "@/lib/permissions";
import { cancelConfirmation } from "@/lib/operator/confirm";
import { applyConfirmed } from "@/lib/operator/dispatch";
import { RATE_LIMIT_CONFIRM } from "@/lib/operator/policy";
import { getOperatorProviderInfo, getToolDeps } from "@/lib/operator/runtime";

/**
 * POST /api/operator/confirm  { token, action: "apply" | "cancel" }
 * Brugerens klik på Anvend/Annullér i et bekræftelseskort. Klienten sender kun tokenet — aldrig input — så forslaget
 * ikke kan ændres. Tokenet er bundet til bruger, værktøj og input, udløber og kan kun bruges én gang.
 */
const bodySchema = z.object({ token: z.string().min(10).max(160), action: z.enum(["apply", "cancel"]).default("apply") });

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ ok: false, message: "Ugyldig oprindelse." }, 403);
  if (!/^application\/json\b/i.test(req.headers.get("content-type") ?? "")) return json({ ok: false, message: "Forventer application/json." }, 415);
  const user = await getAuthorizedUser(PERMISSIONS.OPERATOR_USE);
  if (!user) return json({ ok: false, message: "Ikke autoriseret." }, 401);
  const limited = await rateLimit({ ...RATE_LIMIT_CONFIRM, key: user.id, failMode: "closed" });
  if (!limited.ok) return json({ ok: false, message: "For mange forsøg. Vent lidt." }, 429, rateLimitHeaders(limited));
  const raw = await readJsonBody(req, 2 * 1024);
  if (!raw.ok) return json({ ok: false, message: raw.error }, raw.status);
  const parsed = bodySchema.safeParse(raw.data);
  if (!parsed.success) return json({ ok: false, message: "Ugyldig forespørgsel." }, 400);

  if (parsed.data.action === "cancel") {
    const cancelled = await cancelConfirmation(user, parsed.data.token);
    return json({ ok: cancelled, message: cancelled ? "Handlingen er annulleret." : "Bekræftelsen er ugyldig eller allerede brugt." }, cancelled ? 200 : 404);
  }

  const res = await applyConfirmed({ user, instansId: user.instansId, now: new Date(), sessionId: null, provider: getOperatorProviderInfo()?.id ?? null, ip: getClientIp(req.headers), deps: getToolDeps() }, parsed.data.token);
  if (!res.ok) return json({ ok: false, code: res.code, message: res.message }, res.code === "forbudt" ? 403 : res.code === "udloebet" ? 410 : 404);
  const r = res.result;
  // clientSecret (fx midlertidig adgangskode) vises kun her, til brugerens egen browser, og gemmes/logges aldrig.
  return json({ ok: r.ok, summary: r.summary, undoId: r.undoId ?? null, undoLabel: r.undoLabel ?? null, secret: r.clientSecret ?? null }, 200);
}
